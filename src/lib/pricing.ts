/**
 * Pricing types and pure helpers.
 *
 * Business values (gift-wrap prices, slot fees, delivery charges, coupons and
 * tax) are NEVER defined here. They come from the API:
 *   - GET /checkout/wraps  -> GiftWrap[]
 *   - GET /checkout/slots  -> TimeSlot[]
 *   - GET /store-settings/public -> free-delivery threshold / fee / coupons
 *   - POST /checkout/quote -> authoritative Totals for the current cart
 *
 * The helpers below only format the values the server supplied. Money checks
 * and state transitions always happen on the server.
 */

export interface GiftWrap {
  /** Stable code used by the UI (classic / satin / luxe). */
  id: string;
  /** Database id sent to /checkout/quote and /checkout/place. */
  serverId: string;
  name: string;
  description: string;
  price: number;
}

export interface TimeSlot {
  /** Stable code used by the UI (morning / afternoon / ...). */
  id: string;
  /** Database id sent to /checkout/quote and /checkout/place. */
  serverId: string;
  label: string;
  window: string;
  fee: number;
}

/** Promotional copy from public settings. Discounts are validated server-side. */
export interface Coupon {
  code: string;
  description: string;
}

export interface Totals {
  subtotal: number;
  discount: number;
  delivery: number;
  wrap: number;
  slotFee: number;
  tax: number;
  total: number;
}

export const EMPTY_TOTALS: Totals = {
  subtotal: 0,
  discount: 0,
  delivery: 0,
  wrap: 0,
  slotFee: 0,
  tax: 0,
  total: 0,
};

export function wrapAmount(wraps: GiftWrap[], wrapId?: string | undefined): number {
  return wraps.find((w) => w.id === wrapId)?.price ?? 0;
}

export function slotAmount(slots: TimeSlot[], slotId?: string | undefined): number {
  return slots.find((s) => s.id === slotId)?.fee ?? 0;
}

/**
 * Cart-page preview only. Uses values supplied by the server and the discount
 * returned by /coupons/validate. Checkout always replaces this with the
 * authoritative POST /checkout/quote response.
 */
export function estimateTotals(input: {
  subtotal: number;
  wraps: GiftWrap[];
  slots: TimeSlot[];
  wrapId?: string | undefined;
  slotId?: string | undefined;
  discount?: number | undefined;
  deliveryFee?: number | undefined;
  tax?: number | undefined;
  threshold?: number | undefined;
}): Totals {
  const { subtotal, wraps, slots, wrapId, slotId } = input;
  const wrap = wrapAmount(wraps, wrapId);
  const slotFee = slotAmount(slots, slotId);
  const discount = Math.max(0, input.discount ?? 0);
  const threshold = input.threshold ?? 0;
  const delivery =
    subtotal === 0 || (threshold > 0 && subtotal >= threshold) ? 0 : (input.deliveryFee ?? 0);
  const tax = Math.max(0, input.tax ?? 0);
  const total = Math.max(0, subtotal - discount) + delivery + wrap + slotFee + tax;
  return { subtotal, discount, delivery, wrap, slotFee, tax, total };
}

export function deliveryProgress(subtotal: number, threshold: number) {
  if (threshold <= 0) return { remaining: 0, pct: 100, unlocked: true };
  const remaining = Math.max(0, threshold - subtotal);
  return {
    remaining,
    pct: Math.min(100, (subtotal / threshold) * 100),
    unlocked: remaining === 0,
  };
}
