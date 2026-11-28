/**
 * TanStack Query bindings for the NestJS API. Keeping all fetching here lets
 * the StoreProvider stay a thin adapter over the existing storefront surface.
 */
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import {
  apiClient,
  clearAuthSession,
  getAuthSnapshot,
  getRefreshToken,
  getServerSnapshot,
  hasAuthSession,
  newIdempotencyKey,
  setAuthSession,
  subscribeAuth,
} from "@/lib/api";
import type {
  ApiAddress,
  ApiAuthSession,
  ApiAuthUser,
  ApiCart,
  ApiCategory,
  ApiCheckoutQuote,
  ApiCouponPromo,
  ApiDeliverySlot,
  ApiGiftWrap,
  ApiOrder,
  ApiPaymentSession,
  ApiPlaceOrderResult,
  ApiProduct,
  ApiReview,
  ApiShippingQuote,
  ApiStoreSettings,
} from "@/lib/api-types";

export const queryKeys = {
  products: ["products"] as const,
  product: (slug: string) => ["product", slug] as const,
  categories: ["categories"] as const,
  wraps: ["wraps"] as const,
  slots: ["slots"] as const,
  settings: ["settings"] as const,
  cart: ["cart"] as const,
  me: ["me"] as const,
  addresses: ["addresses"] as const,
  orders: ["orders"] as const,
  order: (number: string) => ["order", number] as const,
  reviews: (slug: string) => ["reviews", slug] as const,
  serviceability: (pincode: string) => ["serviceability", pincode] as const,
} as const;

/** Reactively follows in-memory access-token changes (login/logout/refresh). */
export function useAccessToken(): string | null {
  return useSyncExternalStore(subscribeAuth, getAuthSnapshot, getServerSnapshot);
}

type QueryOptions<T> = Omit<UseQueryOptions<T, Error>, "queryKey" | "queryFn">;

/**
 * The public products endpoint validates `limit` with `@Max(100)`, so asking for
 * more returns HTTP 400. Walk pages instead of requesting an invalid page size.
 */
async function fetchAllProducts(): Promise<ApiProduct[]> {
  const pageSize = 100;
  const maxPages = 20;
  const first = await apiClient.getPaged<ApiProduct[]>(`/products?page=1&limit=${pageSize}`);
  const products = [...first.items];
  const totalPages = Math.min(first.meta?.totalPages ?? 1, maxPages);
  for (let page = 2; page <= totalPages; page += 1) {
    const next = await apiClient.getPaged<ApiProduct[]>(`/products?page=${page}&limit=${pageSize}`);
    products.push(...next.items);
  }
  return products;
}

export function useProducts(options?: QueryOptions<ApiProduct[]>) {
  return useQuery({
    queryKey: queryKeys.products,
    queryFn: fetchAllProducts,
    staleTime: 30_000,
    ...options,
  });
}

export function useProduct(slug: string, options?: QueryOptions<ApiProduct>) {
  return useQuery({
    queryKey: queryKeys.product(slug),
    queryFn: () => apiClient.get<ApiProduct>(`/products/${encodeURIComponent(slug)}`),
    staleTime: 30_000,
    enabled: !!slug,
    ...options,
  });
}

export function useCategories(options?: QueryOptions<ApiCategory[]>) {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => apiClient.get<ApiCategory[]>("/categories"),
    staleTime: 60_000,
    ...options,
  });
}

export function useWraps(options?: QueryOptions<ApiGiftWrap[]>) {
  return useQuery({
    queryKey: queryKeys.wraps,
    queryFn: () => apiClient.get<ApiGiftWrap[]>("/checkout/wraps"),
    staleTime: 60_000,
    ...options,
  });
}

export function useSlots(options?: QueryOptions<ApiDeliverySlot[]>) {
  return useQuery({
    queryKey: queryKeys.slots,
    queryFn: () => apiClient.get<ApiDeliverySlot[]>("/checkout/slots"),
    staleTime: 60_000,
    ...options,
  });
}

export function usePublicSettings(options?: QueryOptions<ApiStoreSettings>) {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => apiClient.get<ApiStoreSettings>("/store-settings/public"),
    staleTime: 60_000,
    ...options,
  });
}

export function useCart(options?: QueryOptions<ApiCart>) {
  return useQuery({
    queryKey: queryKeys.cart,
    queryFn: () => apiClient.get<ApiCart>("/cart"),
    ...options,
  });
}

export function useMe(options?: QueryOptions<ApiAuthUser>) {
  const token = useAccessToken();
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => apiClient.get<ApiAuthUser>("/auth/me"),
    enabled: !!token && hasAuthSession(),
    retry: false,
    ...options,
  });
}

export function useAddresses(options?: QueryOptions<ApiAddress[]>) {
  const token = useAccessToken();
  return useQuery({
    queryKey: queryKeys.addresses,
    queryFn: () => apiClient.get<ApiAddress[]>("/addresses"),
    enabled: !!token,
    ...options,
  });
}

export function useOrders(options?: QueryOptions<ApiOrder[]>) {
  const token = useAccessToken();
  return useQuery({
    queryKey: queryKeys.orders,
    queryFn: () => apiClient.get<ApiOrder[]>("/orders?limit=100"),
    enabled: !!token,
    ...options,
  });
}

export function useOrder(orderNumber: string, options?: QueryOptions<ApiOrder>) {
  return useQuery({
    queryKey: queryKeys.order(orderNumber),
    queryFn: () => apiClient.get<ApiOrder>(`/orders/${encodeURIComponent(orderNumber)}`),
    enabled: !!orderNumber,
    retry: false,
    ...options,
  });
}

export function useProductReviews(slug: string, options?: QueryOptions<ApiReview[]>) {
  return useQuery({
    queryKey: queryKeys.reviews(slug),
    queryFn: () =>
      apiClient.get<ApiReview[]>(`/products/${encodeURIComponent(slug)}/reviews?limit=20`),
    enabled: !!slug,
    ...options,
  });
}

/** Server-authoritative delivery zone lookup; never infer serviceability from
 * pincode prefixes in the browser. */
export function useServiceability(pincode: string, options?: QueryOptions<ApiShippingQuote>) {
  const valid = /^[1-9]\d{5}$/.test(pincode);
  return useQuery({
    queryKey: queryKeys.serviceability(pincode),
    queryFn: () => apiClient.get<ApiShippingQuote>(`/checkout/serviceability/${pincode}`),
    enabled: valid,
    retry: false,
    ...options,
  });
}

/* ----------------------------- mutations ------------------------------ */

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries();
  };
}

export function useLogin() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { email: string; password: string; admin?: boolean }) =>
      apiClient.post<ApiAuthSession>(input.admin ? "/auth/admin/login" : "/auth/login", {
        email: input.email,
        password: input.password,
      }),
    onSuccess: (session) => {
      setAuthSession(session);
      invalidate();
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (input: { name: string; email: string; password: string; phone?: string }) =>
      apiClient.post<{ message: string }>("/auth/register", input),
  });
}

export function useLogout() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async () => {
      const refresh = getRefreshToken();
      try {
        if (refresh) await apiClient.post("/auth/logout", { refreshToken: refresh });
      } finally {
        clearAuthSession();
      }
    },
    onSuccess: invalidate,
    onError: invalidate,
  });
}

export function useUpdateProfile() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (patch: { name?: string; phone?: string }) =>
      apiClient.patch<{ id: string; name: string; phone: string | null }>(
        "/users/me/profile",
        patch,
      ),
    onSuccess: invalidate,
  });
}

export function useAddressMutations() {
  const invalidate = useInvalidate();
  return {
    create: useMutation({
      mutationFn: (input: Omit<ApiAddress, "id">) =>
        apiClient.post<ApiAddress>("/addresses", input),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: Partial<ApiAddress> & { id: string }) =>
        apiClient.patch<ApiAddress>(`/addresses/${id}`, input),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => apiClient.delete(`/addresses/${id}`),
      onSuccess: invalidate,
    }),
  };
}

export function useCartMutations() {
  const invalidate = useInvalidate();
  const refreshCart = () => {
    void invalidate();
  };
  return {
    add: useMutation({
      mutationFn: (input: {
        productId: string;
        quantity: number;
        variantId?: string;
        customizations?: Array<{ fieldKey: string; value: unknown }>;
      }) => apiClient.post<ApiCart>("/cart/items", input),
      onSuccess: refreshCart,
    }),
    update: useMutation({
      mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
        apiClient.patch<ApiCart>(`/cart/items/${id}`, { quantity }),
      onSuccess: refreshCart,
    }),
    remove: useMutation({
      mutationFn: (id: string) => apiClient.delete<ApiCart>(`/cart/items/${id}`),
      onSuccess: refreshCart,
    }),
    setCoupon: useMutation({
      mutationFn: (code: string | null) => apiClient.patch<ApiCart>("/cart/coupon", { code }),
      onSuccess: refreshCart,
    }),
    clear: useMutation({
      mutationFn: () => apiClient.delete("/cart"),
      onSuccess: refreshCart,
    }),
  };
}

export function useCheckoutQuote() {
  return useMutation({
    mutationFn: (input: {
      addressId?: string;
      pincode?: string;
      deliveryDate?: string;
      slotId?: string;
      giftWrapId?: string;
      couponCode?: string;
    }) => apiClient.post<ApiCheckoutQuote>("/checkout/quote", input),
  });
}

export function usePlaceOrder() {
  return useMutation({
    mutationFn: (input: {
      addressId?: string;
      pincode?: string;
      deliveryDate: string;
      slotId?: string;
      giftWrapId?: string;
      customerEmail?: string;
      customerPhone?: string;
      recipientName: string;
      recipientPhone: string;
      addressLine: string;
      city: string;
      cardMessage?: string;
      paymentProvider: "RAZORPAY" | "CASHFREE" | "COD";
    }) =>
      apiClient.post<ApiPlaceOrderResult>("/checkout/place", input, {
        headers: { "X-Idempotency-Key": newIdempotencyKey() },
      }),
  });
}

export function useCreatePayment() {
  return useMutation({
    mutationFn: (input: { orderNumber: string; provider: "RAZORPAY" | "CASHFREE" }) =>
      apiClient.post<ApiPaymentSession>("/payments/create", input),
  });
}

export function useVerifyPayment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: {
      provider: "RAZORPAY" | "CASHFREE";
      providerOrderId: string;
      providerPaymentId?: string;
      signature?: string;
    }) => apiClient.post<{ status: string; orderNumber?: string }>("/payments/verify", input),
    onSuccess: invalidate,
  });
}

export function useValidateCoupon() {
  return useMutation({
    mutationFn: (input: { code: string; subtotal: number }) =>
      apiClient.post<{ code: string; discount: number; description: string }>(
        "/coupons/validate",
        input,
      ),
  });
}

export function useSubmitReview() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      slug,
      ...input
    }: {
      slug: string;
      rating: number;
      title?: string;
      body: string;
    }) => apiClient.post(`/products/${encodeURIComponent(slug)}/reviews`, input),
    onSuccess: invalidate,
  });
}

/** Public promotional copy only — never used to compute a discount locally. */
export function promoFromSettings(settings: ApiStoreSettings | undefined): ApiCouponPromo[] {
  const value = settings?.["public.coupons"];
  if (!value || typeof value !== "object") return [];
  const items = (value as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  return items.filter(
    (item): item is ApiCouponPromo =>
      !!item && typeof item === "object" && typeof (item as ApiCouponPromo).code === "string",
  );
}
