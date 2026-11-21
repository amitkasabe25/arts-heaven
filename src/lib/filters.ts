import type { Product } from "@/lib/catalog";

export const SORT_OPTIONS = [
  { id: "popular", label: "Most popular" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "rating", label: "Top rated" },
  { id: "newest", label: "Newest" },
] as const;

export type SortId = (typeof SORT_OPTIONS)[number]["id"];

export const PRICE_MIN = 99;
export const PRICE_MAX = 499;

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

export function normalizeSort(value: string | undefined): SortId {
  return SORT_OPTIONS.some((o) => o.id === value) ? (value as SortId) : "popular";
}

export function filterProducts(products: Product[], f: ProductFilters): Product[] {
  const q = f.q.trim().toLowerCase();
  const list = products.filter((p) => {
    if (q && !`${p.name} ${p.description} ${p.highlights.join(" ")}`.toLowerCase().includes(q)) return false;
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
