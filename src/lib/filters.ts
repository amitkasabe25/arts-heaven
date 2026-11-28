import type { Product } from "@/lib/catalog";

export const SORT_OPTIONS = [
  { id: "popular", label: "Most popular" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "rating", label: "Top rated" },
  { id: "newest", label: "Newest" },
] as const;

export type SortId = (typeof SORT_OPTIONS)[number]["id"];

/** Fallbacks used before the catalogue has loaded or when it is empty. */
export const PRICE_MIN = 99;
export const PRICE_MAX = 499;
const PRICE_STEP = 10;

export interface PriceBounds {
  min: number;
  max: number;
}

export const DEFAULT_PRICE_BOUNDS: PriceBounds = { min: PRICE_MIN, max: PRICE_MAX };

export interface ProductFilters {
  q: string;
  categories: string[];
  occasions: string[];
  price: [number, number];
  sort: SortId;
  inStockOnly: boolean;
}

export const DEFAULT_FILTERS: ProductFilters = {
  q: "",
  categories: [],
  occasions: [],
  price: [PRICE_MIN, PRICE_MAX],
  sort: "popular",
  inStockOnly: false,
};

/**
 * Derive the price slider range from the products that actually came from the
 * API. The old hardcoded ₹99–₹499 cap silently hid higher-priced stock.
 * Bounds are expanded, never narrowed, and rounded to the slider step so the
 * highest product is always reachable.
 */
export function getPriceBounds(products: Product[]): PriceBounds {
  const prices = products.map((p) => Number(p.price)).filter(Number.isFinite);
  if (prices.length === 0) return { ...DEFAULT_PRICE_BOUNDS };

  const lowest = Math.max(0, Math.min(...prices));
  const highest = Math.max(...prices);
  return {
    min: Math.min(PRICE_MIN, Math.floor(lowest / PRICE_STEP) * PRICE_STEP),
    max: Math.max(PRICE_MAX, Math.ceil(highest / PRICE_STEP) * PRICE_STEP),
  };
}

export function makeDefaultFilters(
  bounds: PriceBounds = DEFAULT_PRICE_BOUNDS,
  overrides: Partial<ProductFilters> = {},
): ProductFilters {
  return {
    ...DEFAULT_FILTERS,
    price: [bounds.min, bounds.max],
    ...overrides,
  };
}

export function normalizeSort(value: string | undefined): SortId {
  return SORT_OPTIONS.some((o) => o.id === value) ? (value as SortId) : "popular";
}

export function filterProducts(products: Product[], f: ProductFilters): Product[] {
  const q = f.q.trim().toLowerCase();
  const list = products.filter((p) => {
    if (q && !`${p.name} ${p.description} ${p.highlights.join(" ")}`.toLowerCase().includes(q))
      return false;
    if (f.categories.length && !f.categories.includes(p.category)) return false;
    if (f.occasions.length && !p.occasions.some((o) => f.occasions.includes(o))) return false;
    if (p.price < f.price[0] || p.price > f.price[1]) return false;
    if (f.inStockOnly && p.stock <= 0) return false;
    return true;
  });
  const sorted = [...list];
  switch (f.sort) {
    case "price-asc":
      sorted.sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      sorted.sort((a, b) => b.price - a.price);
      break;
    case "rating":
      sorted.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
      break;
    case "newest":
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      break;
    default:
      sorted.sort((a, b) => b.popularity - a.popularity);
  }
  return sorted;
}
