/** Wire shapes returned by the NestJS API. Money fields arrive as strings. */

export interface ApiCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  tagline?: string | null;
  thumbnail?: string | null;
  bannerImage?: string | null;
  displayOrder: number;
  isVisible: boolean;
  productCount?: number;
  children?: ApiCategory[];
}

export interface ApiImage {
  id: string;
  url: string;
  alt?: string | null;
  position: number;
  isPrimary: boolean;
}

export interface ApiVariant {
  id: string;
  name: string;
  sku?: string | null;
  options: Record<string, unknown>;
  price: string | number;
  compareAtPrice?: string | number | null;
  stockQty: number;
  isActive: boolean;
  position: number;
}

export interface ApiAttribute {
  key: string;
  value: string;
  position: number;
}

export interface ApiCustomizationField {
  id: string;
  key: string;
  label: string;
  type: string;
  isRequired: boolean;
  options: unknown;
  validation: unknown;
  priceDelta: string | number;
}

export interface ApiCustomizationSchema {
  id: string;
  name: string;
  description?: string | null;
  isRequired: boolean;
  fields: ApiCustomizationField[];
}

export interface ApiProduct {
  id: string;
  slug: string;
  name: string;
  sku?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  category: { id: string; name: string; slug: string };
  basePrice: string | number;
  sellingPrice: string | number;
  compareAtPrice?: string | number | null;
  status: string;
  productType: string;
  isFeatured: boolean;
  isBestSeller: boolean;
  stockQty: number;
  ratingAverage: string | number;
  ratingCount: number;
  createdAt: string;
  images: ApiImage[];
  variants?: ApiVariant[];
  attributes?: ApiAttribute[];
  customizationSchemas?: ApiCustomizationSchema[];
  approvedReviewsCount?: number;
}

export interface ApiCartItem {
  id: string;
  productId: string | null;
  variantId: string | null;
  quantity: number;
  unitPriceSnapshot: string | number;
  /** Prisma JSON snapshot: { name, image, variantName, options, ... }. */
  productSnapshot: Record<string, unknown>;
  customizations: unknown;
}

export interface ApiCart {
  id: string;
  count: number;
  subtotal: number;
  couponCode: string | null;
  items: ApiCartItem[];
}

export interface ApiShippingQuote {
  serviceable: boolean;
  zone: string;
  deliveryFee: string | number;
  estimatedMinDate: string;
  estimatedMaxDate: string;
  sameDayEligible: boolean;
}

export interface ApiCheckoutQuote {
  items: Array<{
    cartItemId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    productId: string | null;
    variantId: string | null;
  }>;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  giftWrapFee: number;
  slotFee: number;
  tax: number;
  total: number;
  couponCode: string | null;
  pincode: string;
  shipping: ApiShippingQuote;
}

export interface ApiPlaceOrderResult {
  orderId: string;
  orderNumber: string;
  status: string;
  total: number;
  paymentProvider: string;
}

export interface ApiGiftWrap {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  price: string | number;
}

export interface ApiDeliverySlot {
  id: string;
  code: string;
  label: string;
  windowText: string;
  fee: string | number;
}

export interface ApiAuthUser {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  roles: string[];
  permissions: string[];
}

export interface ApiAuthSession {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  user: ApiAuthUser;
}

export interface ApiAddress {
  id: string;
  label: string;
  name: string;
  phone: string;
  addressLine: string;
  city: string;
  state?: string | null;
  pincode: string;
  isDefault: boolean;
}

export interface ApiOrderItem {
  id: string;
  nameSnapshot: string;
  skuSnapshot?: string | null;
  imageSnapshot?: string | null;
  variantSnapshot?: Record<string, unknown>;
  quantity: number;
  unitPrice: string | number;
  customizations?: unknown;
}

export interface ApiOrder {
  id: string;
  orderNumber: string;
  status: string;
  customerSnapshot: Record<string, unknown>;
  addressSnapshot: Record<string, unknown>;
  deliveryDate?: string | null;
  deliverySlotId?: string | null;
  giftWrapId?: string | null;
  cardMessage?: string | null;
  subtotal: string | number;
  discount: string | number;
  deliveryFee: string | number;
  giftWrapFee: string | number;
  slotFee: string | number;
  tax: string | number;
  total: string | number;
  paymentProvider: string;
  createdAt: string;
  items: ApiOrderItem[];
  payments?: Array<{ status: string; provider: string; providerPaymentId?: string | null }>;
}

/** `/payments/create` returns the payment ids plus the flattened provider
 * checkout payload (Razorpay: keyId/orderId/amount/prefill; Cashfree:
 * paymentSessionId/environment). */
export type ApiPaymentSession = {
  paymentId: string;
  providerOrderId: string;
} & Record<string, unknown>;

export interface ApiCouponPromo {
  code: string;
  description: string;
}

export interface ApiReview {
  id: string;
  rating: number;
  title?: string | null;
  body: string;
  createdAt: string;
  user: { id: string; name: string };
}

export interface ApiStoreSettings {
  [key: string]: unknown;
}
