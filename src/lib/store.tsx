import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { Category, Order, Product } from "@/lib/catalog";
import {
  useAccessToken,
  useAddressMutations,
  useAddresses,
  useCart,
  useCartMutations,
  useCategories,
  useLogin,
  useLogout,
  useMe,
  useOrders,
  usePlaceOrder,
  useProducts,
  usePublicSettings,
  useRegister,
  useSlots,
  useUpdateProfile,
  useWraps,
  promoFromSettings,
} from "@/lib/api-hooks";
import type { ApiOrder, ApiProduct } from "@/lib/api-types";
import {
  mapCart,
  mapCategory,
  mapOrder,
  mapProduct,
  mapProfile,
  mapSlots,
  mapWraps,
} from "@/lib/mappers";
import {
  estimateTotals,
  type Coupon,
  type GiftWrap,
  type TimeSlot,
  type Totals,
} from "@/lib/pricing";

export interface CartLine {
  lineId: string;
  kind: "product" | "box";
  productId?: string;
  name: string;
  image: string;
  unitPrice: number;
  qty: number;
  details?: string;
}

export interface GiftOptions {
  wrapId: string;
  cardMessage: string;
  cardFrom: string;
  couponCode: string;
}

export interface Address {
  id: string;
  label: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  pincode: string;
}

export interface Profile {
  name: string;
  email: string;
  phone: string;
  birthday: string;
  addresses: Address[];
}

export interface Preferences {
  newsletter: boolean;
  smsUpdates: boolean;
  occasionReminders: boolean;
}

export interface AddToCartOptions {
  qty?: number;
  size?: string;
  sizeExtra?: number;
  personalization?: string;
}

export interface PlaceOrderInput {
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
}

export interface PlaceOrderResult {
  orderId: string;
  orderNumber: string;
  status: string;
  total: number;
  paymentProvider: string;
}

const DEFAULT_GIFT: GiftOptions = { wrapId: "", cardMessage: "", cardFrom: "", couponCode: "" };
const DEFAULT_PREFS: Preferences = { newsletter: true, smsUpdates: false, occasionReminders: true };

const BIRTHDAY_KEY = "artsheaven:v1:birthday";
const PREFS_KEY = "artsheaven:v1:prefs";
const WISHLIST_KEY = "artsheaven:v1:wishlist";

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be blocked; the in-memory copy still works for this session.
  }
}

interface StoreValue {
  // Catalogue (server-backed)
  products: Product[];
  categories: Category[];
  wraps: GiftWrap[];
  slots: TimeSlot[];
  coupons: Coupon[];
  settings: Record<string, unknown>;
  freeDeliveryThreshold: number;
  deliveryFee: number;
  hydrated: boolean;

  // Cart (server-backed)
  cart: CartLine[];
  cartCount: number;
  cartSubtotal: number;
  cartCouponCode: string;

  // Local draft / preferences
  wishlist: string[];
  gift: GiftOptions;
  profile: Profile;
  prefs: Preferences;

  // Auth (server-backed)
  user: ReturnType<typeof useMe>["data"];
  isAuthenticated: boolean;
  login: (email: string, password: string, admin?: boolean) => Promise<void>;
  register: (input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;

  // Cart actions
  addToCart: (product: Product, opts?: AddToCartOptions) => Promise<void>;
  addBoxToCart: (line: Omit<CartLine, "lineId" | "kind" | "qty">) => void;
  updateQty: (lineId: string, qty: number) => Promise<void>;
  removeLine: (lineId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  setCartCoupon: (code: string | null) => Promise<void>;
  toggleWishlist: (productId: string) => boolean;
  isWishlisted: (productId: string) => boolean;
  setGift: (patch: Partial<GiftOptions>) => void;

  // Orders (server-backed)
  orders: Order[];
  placeOrder: (input: PlaceOrderInput) => Promise<PlaceOrderResult>;

  // Profile actions
  setProfile: (patch: Partial<Profile>) => Promise<void>;
  setPrefs: (patch: Partial<Preferences>) => void;
  refresh: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function settingNumber(settings: Record<string, unknown> | undefined, key: string): number {
  const value = settings?.[key];
  if (!value || typeof value !== "object") return 0;
  const amount = (value as { amount?: unknown }).amount;
  return typeof amount === "number" ? amount : 0;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const token = useAccessToken();

  const productsQuery = useProducts();
  const categoriesQuery = useCategories();
  const wrapsQuery = useWraps();
  const slotsQuery = useSlots();
  const settingsQuery = usePublicSettings();
  const cartQuery = useCart();
  const meQuery = useMe();
  const addressesQuery = useAddresses();
  const ordersQuery = useOrders();

  const cartMutations = useCartMutations();
  const placeOrderMutation = usePlaceOrder();
  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const logoutMutation = useLogout();
  const profileMutation = useUpdateProfile();
  const addressMutations = useAddressMutations();

  const [wishlist, setWishlist] = useState<string[]>(() => readLocal(WISHLIST_KEY, []));
  const [gift, setGiftState] = useState<GiftOptions>(DEFAULT_GIFT);
  const [birthday, setBirthday] = useState<string>(() => readLocal(BIRTHDAY_KEY, ""));
  const [prefs, setPrefsState] = useState<Preferences>(() => readLocal(PREFS_KEY, DEFAULT_PREFS));

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries();
  }, [queryClient]);

  const products = useMemo(() => (productsQuery.data ?? []).map(mapProduct), [productsQuery.data]);
  const categories = useMemo(
    () => (categoriesQuery.data ?? []).map(mapCategory),
    [categoriesQuery.data],
  );
  const wraps = useMemo(() => mapWraps(wrapsQuery.data ?? []), [wrapsQuery.data]);
  const slots = useMemo(() => mapSlots(slotsQuery.data ?? []), [slotsQuery.data]);
  const settings = useMemo(
    () => (settingsQuery.data ?? {}) as Record<string, unknown>,
    [settingsQuery.data],
  );
  const coupons = useMemo(() => promoFromSettings(settingsQuery.data), [settingsQuery.data]);

  const cartResult = useMemo(
    () =>
      cartQuery.data
        ? mapCart(cartQuery.data)
        : { cart: [] as CartLine[], subtotal: 0, count: 0, couponCode: "" },
    [cartQuery.data],
  );

  const orders = useMemo(
    () => (ordersQuery.data ?? []).map((order: ApiOrder) => mapOrder(order, wraps, slots)),
    [ordersQuery.data, wraps, slots],
  );

  const profile = useMemo(
    () => ({
      ...mapProfile(meQuery.data ?? null, addressesQuery.data ?? []),
      birthday,
    }),
    [meQuery.data, addressesQuery.data, birthday],
  );

  const hydrated = productsQuery.isFetched && categoriesQuery.isFetched && cartQuery.isFetched;

  const reportError = useCallback((error: unknown, fallback: string) => {
    const message = error instanceof Error ? error.message : fallback;
    toast.error(message);
  }, []);

  const addToCart = useCallback(
    async (product: Product, opts: AddToCartOptions = {}) => {
      try {
        const raw = productsQuery.data?.find((item) => item.slug === product.slug) as
          ApiProduct | undefined;
        const variant = raw?.variants?.find((item) => item.name === opts.size);
        const textField = raw?.customizationSchemas
          ?.flatMap((schema) => schema.fields)
          .find((field) => field.type === "TEXT" || field.type === "TEXTAREA");
        await cartMutations.add.mutateAsync({
          productId: product.id,
          quantity: opts.qty ?? 1,
          ...(variant ? { variantId: variant.id } : {}),
          ...(opts.personalization && textField
            ? { customizations: [{ fieldKey: textField.key, value: opts.personalization }] }
            : {}),
        });
        toast.success(`${product.name} added to your cart`);
      } catch (error) {
        reportError(error, "Could not add this gift to your cart");
      }
    },
    [cartMutations.add, productsQuery.data, reportError],
  );

  const addBoxToCart = useCallback((line: Omit<CartLine, "lineId" | "kind" | "qty">) => {
    // Build-a-box is configured server-side; until a dedicated box product
    // exists, keep the draft line local so the undo action still works.
    toast.info("Custom boxes will be available soon");
    void line;
  }, []);

  const updateQty = useCallback(
    async (lineId: string, qty: number) => {
      try {
        await cartMutations.update.mutateAsync({
          id: lineId,
          quantity: Math.max(1, Math.min(10, qty)),
        });
      } catch (error) {
        reportError(error, "Could not update your cart");
      }
    },
    [cartMutations.update, reportError],
  );

  const removeLine = useCallback(
    async (lineId: string) => {
      try {
        await cartMutations.remove.mutateAsync(lineId);
      } catch (error) {
        reportError(error, "Could not remove this item");
      }
    },
    [cartMutations.remove, reportError],
  );

  const clearCart = useCallback(async () => {
    try {
      await cartMutations.clear.mutateAsync();
      setGiftState(DEFAULT_GIFT);
    } catch (error) {
      reportError(error, "Could not clear your cart");
    }
  }, [cartMutations.clear, reportError]);

  const setCartCoupon = useCallback(
    async (code: string | null) => {
      try {
        await cartMutations.setCoupon.mutateAsync(code);
        if (code) toast.success(`${code} applied`);
      } catch (error) {
        reportError(error, "That coupon could not be applied");
      }
    },
    [cartMutations.setCoupon, reportError],
  );

  const setGift = useCallback(
    (patch: Partial<GiftOptions>) => {
      setGiftState((current) => ({ ...current, ...patch }));
      if (Object.prototype.hasOwnProperty.call(patch, "couponCode")) {
        void setCartCoupon(patch.couponCode ?? null);
      }
    },
    [setCartCoupon],
  );

  const toggleWishlist = useCallback(
    (productId: string) => {
      const adding = !wishlist.includes(productId);
      setWishlist((current) => {
        const next = adding ? [...current, productId] : current.filter((id) => id !== productId);
        writeLocal(WISHLIST_KEY, next);
        return next;
      });
      return adding;
    },
    [wishlist],
  );

  const isWishlisted = useCallback((id: string) => wishlist.includes(id), [wishlist]);

  const placeOrder = useCallback(
    async (input: PlaceOrderInput) => {
      return placeOrderMutation.mutateAsync(input);
    },
    [placeOrderMutation],
  );

  const setProfile = useCallback(
    async (patch: Partial<Profile>) => {
      try {
        if (patch.name !== undefined || patch.phone !== undefined) {
          await profileMutation.mutateAsync({
            ...(patch.name !== undefined ? { name: patch.name } : {}),
            ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
          });
        }
        if (patch.birthday !== undefined) {
          setBirthday(patch.birthday);
          writeLocal(BIRTHDAY_KEY, patch.birthday);
        }
        const nextAddress = patch.addresses?.[0];
        if (nextAddress && token) {
          if (nextAddress.id) {
            await addressMutations.update.mutateAsync({
              id: nextAddress.id,
              label: nextAddress.label,
              name: nextAddress.name,
              phone: nextAddress.phone,
              addressLine: nextAddress.address,
              city: nextAddress.city,
              pincode: nextAddress.pincode,
            });
          } else {
            await addressMutations.create.mutateAsync({
              label: nextAddress.label,
              name: nextAddress.name,
              phone: nextAddress.phone,
              addressLine: nextAddress.address,
              city: nextAddress.city,
              pincode: nextAddress.pincode,
              isDefault: true,
            });
          }
        }
        refresh();
        toast.success("Profile updated");
      } catch (error) {
        reportError(error, "Could not save your profile");
      }
    },
    [addressMutations, profileMutation, refresh, reportError, token],
  );

  const setPrefs = useCallback((patch: Partial<Preferences>) => {
    setPrefsState((current) => {
      const next = { ...current, ...patch };
      writeLocal(PREFS_KEY, next);
      return next;
    });
  }, []);

  const login = useCallback(
    async (email: string, password: string, admin = false) => {
      await loginMutation.mutateAsync({ email, password, admin });
      refresh();
    },
    [loginMutation, refresh],
  );

  const register = useCallback(
    async (input: { name: string; email: string; password: string; phone?: string }) => {
      await registerMutation.mutateAsync(input);
    },
    [registerMutation],
  );

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
    refresh();
  }, [logoutMutation, refresh]);

  const value = useMemo<StoreValue>(
    () => ({
      products,
      categories,
      wraps,
      slots,
      coupons,
      settings,
      freeDeliveryThreshold: settingNumber(settings, "public.free_delivery_threshold"),
      deliveryFee: settingNumber(settings, "public.delivery_fee"),
      hydrated,
      cart: cartResult.cart,
      cartCount: cartResult.count,
      cartSubtotal: cartResult.subtotal,
      cartCouponCode: cartResult.couponCode,
      wishlist,
      gift,
      profile,
      prefs,
      user: meQuery.data ?? undefined,
      isAuthenticated: !!token && !!meQuery.data,
      login,
      register,
      logout,
      addToCart,
      addBoxToCart,
      updateQty,
      removeLine,
      clearCart,
      setCartCoupon,
      toggleWishlist,
      isWishlisted,
      setGift,
      orders,
      placeOrder,
      setProfile,
      setPrefs,
      refresh,
    }),
    [
      products,
      categories,
      wraps,
      slots,
      coupons,
      settings,
      hydrated,
      cartResult,
      wishlist,
      gift,
      profile,
      prefs,
      meQuery.data,
      token,
      login,
      register,
      logout,
      addToCart,
      addBoxToCart,
      updateQty,
      removeLine,
      clearCart,
      setCartCoupon,
      toggleWishlist,
      isWishlisted,
      setGift,
      orders,
      placeOrder,
      setProfile,
      setPrefs,
      refresh,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}

/** Storefront-visible products: active and in a visible category. */
export function useVisibleProducts(): Product[] {
  const { products, categories } = useStore();
  return useMemo(() => {
    const visible = new Set(categories.filter((c) => c.visible).map((c) => c.slug));
    return products.filter((p) => p.active && visible.has(p.category));
  }, [products, categories]);
}

/** Convenience: estimate totals from server-supplied values for the cart page. */
export function useCartTotals(overrides?: {
  wrapId?: string | undefined;
  slotId?: string | undefined;
  discount?: number | undefined;
}): Totals {
  const { cartSubtotal, wraps, slots, freeDeliveryThreshold, deliveryFee, gift } = useStore();
  return estimateTotals({
    subtotal: cartSubtotal,
    wraps,
    slots,
    wrapId: overrides?.wrapId ?? gift.wrapId,
    ...(overrides?.slotId ? { slotId: overrides.slotId } : {}),
    ...(overrides?.discount !== undefined ? { discount: overrides.discount } : {}),
    threshold: freeDeliveryThreshold,
    deliveryFee,
  });
}
