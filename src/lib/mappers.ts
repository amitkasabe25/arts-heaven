import type { Category, OccasionId, Order, OrderStatus, Product, ProductSize } from "@/lib/catalog";
import { PRODUCT_IMAGES } from "@/lib/images";
import type { GiftWrap, TimeSlot, Totals } from "@/lib/pricing";
import type { Address, CartLine, Profile } from "@/lib/store";
import type {
  ApiAddress,
  ApiAuthUser,
  ApiCart,
  ApiCartItem,
  ApiCategory,
  ApiCheckoutQuote,
  ApiDeliverySlot,
  ApiGiftWrap,
  ApiOrder,
  ApiProduct,
} from "@/lib/api-types";

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const text = (value: unknown, fallback = ""): string =>
  typeof value === "string" && value.length > 0 ? value : fallback;

const num = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** Seed images are stored as /images/products/<key>.jpg; map them back to the
 * bundled asset keys so the existing design renders without a public folder. */
export function serverImageRef(raw: string | null | undefined): string {
  if (!raw) return "";
  const filename = raw.split("/").pop() ?? raw;
  const key = filename.replace(/\.[a-z0-9]+$/i, "");
  if (key in PRODUCT_IMAGES) return key;
  return raw;
}

export function mapCategory(raw: ApiCategory): Category {
  return {
    slug: raw.slug,
    name: raw.name,
    tagline: text(raw.tagline),
    description: text(raw.description),
    image: serverImageRef(raw.thumbnail ?? raw.bannerImage),
    visible: raw.isVisible,
  };
}

export function mapProduct(raw: ApiProduct): Product {
  const attributes = raw.attributes ?? [];
  const values = (key: string): string[] =>
    attributes.filter((a) => a.key === key).map((a) => a.value);
  const highlights = values("highlight");
  const base = num(raw.sellingPrice);
  const sizes: ProductSize[] = (raw.variants ?? []).map((variant) => ({
    label: variant.name,
    extra: Math.max(0, Math.round(num(variant.price) - base)),
  }));
  const tags = values("tag").filter(
    (tag): tag is Product["tags"][number] =>
      tag === "bestseller" || tag === "new" || tag === "limited",
  );
  if (raw.isBestSeller && !tags.includes("bestseller")) tags.push("bestseller");
  if (raw.isFeatured && tags.length === 0) tags.push("new");

  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    category: raw.category.slug,
    price: base,
    ...(raw.compareAtPrice ? { compareAt: num(raw.compareAtPrice) } : {}),
    images: [...raw.images]
      .sort(
        (a, b) =>
          Number(a.isPrimary === false) - Number(b.isPrimary === false) || a.position - b.position,
      )
      .map((image) => serverImageRef(image.url)),
    rating: num(raw.ratingAverage),
    reviews: num(raw.ratingCount),
    popularity: raw.isBestSeller ? 100 : raw.isFeatured ? 90 : 0,
    description: text(raw.description ?? raw.shortDescription),
    highlights:
      highlights.length > 0
        ? highlights
        : text(raw.shortDescription)
            .split("·")
            .map((part) => part.trim())
            .filter(Boolean),
    occasions: values("occasion").filter((value): value is OccasionId =>
      ["birthday", "anniversary", "love", "thank-you", "congratulations", "just-because"].includes(
        value,
      ),
    ),
    tags,
    stock: num(raw.stockQty),
    personalizable:
      raw.productType === "CUSTOMIZABLE" || (raw.customizationSchemas?.length ?? 0) > 0,
    sizes,
    createdAt: raw.createdAt,
    active: raw.status === "ACTIVE",
  };
}

function customDetails(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  const parts = value
    .map((entry) => {
      const item = asRecord(entry);
      const raw = item["value"];
      if (raw === null || raw === undefined || raw === "") return undefined;
      return typeof raw === "object" ? JSON.stringify(raw) : String(raw);
    })
    .filter((part): part is string => !!part);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

export function mapCartItem(raw: ApiCartItem): CartLine {
  const snapshot = asRecord(raw.productSnapshot);
  const options = asRecord(snapshot["options"]);
  const variantName = text(snapshot["variantName"] ?? options["size"] ?? options["name"]);
  const custom = customDetails(raw.customizations);
  const details = [variantName, custom ? `“${custom}”` : undefined].filter(Boolean).join(" · ");
  return {
    lineId: raw.id,
    kind: "product",
    ...(raw.productId ? { productId: raw.productId } : {}),
    name: text(snapshot["name"], "Gift"),
    image: serverImageRef(text(snapshot["image"])),
    unitPrice: num(raw.unitPriceSnapshot),
    qty: raw.quantity,
    ...(details ? { details } : {}),
  };
}

export function mapCart(raw: ApiCart): {
  cart: CartLine[];
  subtotal: number;
  count: number;
  couponCode: string;
} {
  const cart = raw.items.map(mapCartItem);
  return {
    cart,
    subtotal: num(raw.subtotal),
    count: num(raw.count),
    couponCode: text(raw.couponCode),
  };
}

export function mapQuote(quote: ApiCheckoutQuote): Totals {
  return {
    subtotal: num(quote.subtotal),
    discount: num(quote.discount),
    delivery: num(quote.deliveryFee),
    wrap: num(quote.giftWrapFee),
    slotFee: num(quote.slotFee),
    tax: num(quote.tax),
    total: num(quote.total),
  };
}

export function mapWraps(raw: ApiGiftWrap[]): GiftWrap[] {
  return raw.map((wrap) => ({
    id: wrap.code,
    serverId: wrap.id,
    name: wrap.name,
    description: text(wrap.description),
    price: num(wrap.price),
  }));
}

export function mapSlots(raw: ApiDeliverySlot[]): TimeSlot[] {
  return raw.map((slot) => ({
    id: slot.code,
    serverId: slot.id,
    label: slot.label,
    window: slot.windowText,
    fee: num(slot.fee),
  }));
}

export function mapAddress(raw: ApiAddress): Address {
  return {
    id: raw.id,
    label: raw.label,
    name: raw.name,
    phone: raw.phone,
    address: raw.addressLine,
    city: raw.city,
    pincode: raw.pincode,
  };
}

export function mapProfile(user: ApiAuthUser | null, addresses: ApiAddress[]): Profile {
  return {
    name: user?.name ?? "Guest Gifter",
    email: user?.email ?? "you@example.com",
    phone: text(user?.phone),
    birthday: "",
    addresses: addresses.map(mapAddress),
  };
}

const ORDER_STATUS_MAP: Record<string, import("@/lib/catalog").OrderStatus> = {
  PENDING: "placed",
  PAYMENT_PENDING: "placed",
  CONFIRMED: "placed",
  PROCESSING: "preparing",
  CUSTOMIZATION_REQUIRED: "preparing",
  READY_TO_SHIP: "preparing",
  SHIPPED: "out-for-delivery",
  OUT_FOR_DELIVERY: "out-for-delivery",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  REFUNDED: "cancelled",
};

export function mapOrder(
  raw: ApiOrder,
  wraps: Array<{ id: string; serverId: string }>,
  slots: Array<{ id: string; serverId: string }>,
): Order {
  const customer = asRecord(raw.customerSnapshot);
  const address = asRecord(raw.addressSnapshot);
  const slotCode =
    slots.find((slot) => slot.serverId === raw.deliverySlotId || slot.id === raw.deliverySlotId)
      ?.id ??
    raw.deliverySlotId ??
    "";
  const wrapCode =
    wraps.find((wrap) => wrap.serverId === raw.giftWrapId || wrap.id === raw.giftWrapId)?.id ??
    raw.giftWrapId ??
    "";
  const status = ORDER_STATUS_MAP[raw.status] ?? "placed";
  return {
    id: raw.orderNumber,
    createdAt: raw.createdAt,
    status,
    mine: true,
    customer: {
      name: text(customer["name"], text(customer["fullName"], "Customer")),
      email: text(customer["email"]),
      phone: text(customer["phone"]),
    },
    recipient: {
      name: text(address["name"], text(customer["name"], "Recipient")),
      phone: text(address["phone"], text(customer["phone"])),
      address: text(address["addressLine"] ?? address["address"]),
      city: text(address["city"]),
      pincode: text(address["pincode"]),
    },
    delivery: { date: text(raw.deliveryDate).slice(0, 10), slotId: slotCode },
    giftWrapId: wrapCode,
    cardMessage: text(raw.cardMessage),
    paymentMethod: raw.paymentProvider.replace(/_/g, " ").toLowerCase(),
    lines: raw.items.map((item) => {
      const details = customDetails(item.customizations);
      return {
        name: item.nameSnapshot,
        qty: item.quantity,
        unitPrice: num(item.unitPrice),
        image: serverImageRef(text(item.imageSnapshot)),
        ...(details ? { details } : {}),
      };
    }),
    totals: {
      subtotal: num(raw.subtotal),
      discount: num(raw.discount),
      delivery: num(raw.deliveryFee),
      wrap: num(raw.giftWrapFee),
      slotFee: num(raw.slotFee),
      tax: num(raw.tax),
      total: num(raw.total),
    },
  };
}
