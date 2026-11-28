import { describe, expect, it } from "vitest";

import type { Product } from "@/lib/catalog";
import { filterProducts, getPriceBounds, makeDefaultFilters, PRICE_MAX } from "@/lib/filters";

function product(id: string, price: number): Product {
  return {
    id,
    slug: id,
    name: id,
    category: "fresh-flowers",
    price,
    images: [],
    rating: 0,
    reviews: 0,
    popularity: 0,
    description: "",
    highlights: [],
    occasions: [],
    tags: [],
    stock: 10,
    personalizable: false,
    sizes: [],
    createdAt: "2026-01-01",
    active: true,
  };
}

describe("price filters", () => {
  it("uses the hardcoded fallback bounds before the catalogue loads", () => {
    expect(getPriceBounds([])).toEqual({ min: 99, max: PRICE_MAX });
  });

  it("expands the maximum to include the highest price from the catalogue", () => {
    const bounds = getPriceBounds([product("cheap", 199), product("expensive", 1299)]);

    expect(bounds.max).toBeGreaterThanOrEqual(1299);
    expect(bounds.max).toBe(1300);
  });

  it("does not hide products priced above the old ₹499 cap", () => {
    const products = [product("regular", 299), product("premium", 1299)];
    const filters = makeDefaultFilters(getPriceBounds(products));

    expect(filterProducts(products, filters).map((p) => p.id)).toEqual(["regular", "premium"]);
  });
});
