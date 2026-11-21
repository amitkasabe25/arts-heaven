/** Store pricing rules. All amounts in INR. */

export const FREE_DELIVERY_THRESHOLD = 499;
export const DELIVERY_FEE = 49;

export interface GiftWrap {
  id: string;
  name: string;
  description: string;
  price: number;
}

export const GIFT_WRAPS: GiftWrap[] = [
  { id: "classic", name: "Classic tissue", description: "Soft white tissue & twine", price: 0 },
  { id: "satin", name: "Satin ribbon", description: "Lavender paper with a satin bow", price: 29 },
  { id: "luxe", name: "Luxe keepsake box", description: "Rigid lilac box, reusable", price: 59 },
];

export interface TimeSlot {
  id: string;
  label: string;
  window: string;
  fee: number;
}

export const TIME_SLOTS: TimeSlot[] = [
  { id: "morning", label: "Morning", window: "9 AM – 12 PM", fee: 0 },
  { id: "afternoon", label: "Afternoon", window: "12 PM – 4 PM", fee: 0 },
  { id: "evening", label: "Evening", window: "4 PM – 9 PM", fee: 0 },
  { id: "midnight", label: "Midnight surprise", window: "11:30 PM – 12 AM", fee: 79 },
];

export interface Coupon {
  code: string;
  type: "percent" | "flat";
  value: number;
  minSubtotal: number;
  description: string;
}

export const COUPONS: Coupon[] = [
  { code: "HEAVEN10", type: "percent", value: 10, minSubtotal: 299, description: "10% off orders above ₹299" },
  { code: "FIRSTGIFT", type: "flat", value: 50, minSubtotal: 399, description: "₹50 off orders above ₹399" },
];

export function findCoupon(code: string | null | undefined): Coupon | undefined {
  if (!code) return undefined;
  return COUPONS.find((c) => c.code === code.trim().toUpperCase());
}

export type CouponCheck = { ok: true; coupon: Coupon } | { ok: false; reason: string };

export function checkCoupon(code: string, subtotal: number): CouponCheck {
  const coupon = findCoupon(code);
  if (!coupon) return { ok: false, reason: "That code isn't valid." };
  if (subtotal < coupon.minSubtotal)
    return { ok: false, reason: `Add ₹${coupon.minSubtotal - subtotal} more to use ${coupon.code}.` };
  return { ok: true, coupon };
}

export interface TotalsInput {
  subtotal: number;
  wrapId?: string | undefined;
  slotId?: string | undefined;
  couponCode?: string | undefined;
}

export interface Totals {
  subtotal: number;
  discount: number;
  delivery: number;
  wrap: number;
  slotFee: number;
  total: number;
}

export function calcTotals({ subtotal, wrapId, slotId, couponCode }: TotalsInput): Totals {
  const wrap = GIFT_WRAPS.find((w) => w.id === wrapId)?.price ?? 0;
  const slotFee = TIME_SLOTS.find((s) => s.id === slotId)?.fee ?? 0;
  const check = couponCode ? checkCoupon(couponCode, subtotal) : null;
  let discount = 0;
  if (check?.ok) {
    discount =
      check.coupon.type === "percent"
        ? Math.round((subtotal * check.coupon.value) / 100)
        : check.coupon.value;
  }
  const delivery = subtotal === 0 || subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  const total = Math.max(0, subtotal - discount) + delivery + wrap + slotFee;
  return { subtotal, discount, delivery, wrap, slotFee, total };
}

/* ---------- Build your own gift box ---------- */

export interface BoxSize {
  id: string;
  name: string;
  capacity: number;
  price: number;
  description: string;
}

export const BOX_SIZES: BoxSize[] = [
  { id: "petite", name: "Petite", capacity: 3, price: 49, description: "Room for 3 little treats" },
  { id: "classic", name: "Classic", capacity: 5, price: 79, description: "Room for 5 thoughtful picks" },
  { id: "grand", name: "Grand", capacity: 8, price: 99, description: "Room for 8 — go all out" },
];

export interface BoxItem {
  id: string;
  name: string;
  price: number;
  emoji: string;
  group: "Sweets" | "Cuddles" | "Blooms" | "Keepsakes";
}

export const BOX_ITEMS: BoxItem[] = [
  { id: "truffles", name: "Hazelnut truffles (4)", price: 89, emoji: "🍫", group: "Sweets" },
  { id: "macarons", name: "French macarons (3)", price: 99, emoji: "🧁", group: "Sweets" },
  { id: "cookies", name: "Butter heart cookies", price: 59, emoji: "🍪", group: "Sweets" },
  { id: "candy", name: "Pastel candy jar", price: 49, emoji: "🍬", group: "Sweets" },
  { id: "mini-teddy", name: "Mini lavender teddy", price: 129, emoji: "🧸", group: "Cuddles" },
  { id: "bunny-keychain", name: "Plush bunny keychain", price: 79, emoji: "🐰", group: "Cuddles" },
  { id: "dried-posy", name: "Dried lavender posy", price: 99, emoji: "💐", group: "Blooms" },
  { id: "single-rose", name: "Preserved pink rose", price: 119, emoji: "🌹", group: "Blooms" },
  { id: "candle", name: "Lilac soy candle", price: 149, emoji: "🕯️", group: "Keepsakes" },
  { id: "scrunchie", name: "Satin scrunchie set", price: 69, emoji: "🎀", group: "Keepsakes" },
  { id: "photo-print", name: "Polaroid photo print", price: 39, emoji: "📸", group: "Keepsakes" },
  { id: "bath-bomb", name: "Lavender bath bomb", price: 79, emoji: "🫧", group: "Keepsakes" },
];

/** Quantities keyed by box item id. */
export type BoxSelection = Record<string, number>;

export function boxItemCount(selection: BoxSelection): number {
  return Object.values(selection).reduce((a, b) => a + b, 0);
}

export function calcBoxPrice(sizeId: string, selection: BoxSelection): number {
  const size = BOX_SIZES.find((s) => s.id === sizeId);
  const base = size?.price ?? 0;
  const items = Object.entries(selection).reduce((sum, [id, qty]) => {
    const item = BOX_ITEMS.find((i) => i.id === id);
    return sum + (item ? item.price * qty : 0);
  }, 0);
  return base + items;
}

export function canAddToBox(sizeId: string, selection: BoxSelection): boolean {
  const size = BOX_SIZES.find((s) => s.id === sizeId);
  return !!size && boxItemCount(selection) < size.capacity;
}
