import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, X, Search, PackageSearch } from "lucide-react";

import { EmptyState } from "@/components/site/EmptyState";
import { ProductCard } from "@/components/site/ProductCard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { OCCASIONS } from "@/lib/catalog";
import { DEFAULT_FILTERS, filterProducts, PRICE_MAX, PRICE_MIN, SORT_OPTIONS, normalizeSort, type ProductFilters } from "@/lib/filters";
import { formatINR } from "@/lib/format";
import { useStore, useVisibleProducts } from "@/lib/store";
import { cn } from "@/lib/utils";

interface Props {
  lockedCategory?: string;
  initialQ?: string | undefined;
  initialOccasion?: string | undefined;
  initialSort?: string | undefined;
}

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function FilterPanel({ filters, setFilters, lockedCategory }: { filters: ProductFilters; setFilters: (f: ProductFilters) => void; lockedCategory?: string | undefined }) {
  const { categories } = useStore();
  return (
    <div className="space-y-8">
      {!lockedCategory && (
        <div>
          <p className="eyebrow mb-3">Category</p>
          <div className="space-y-2.5">
            {categories
              .filter((c) => c.visible)
              .map((c) => (
                <label key={c.slug} className="flex cursor-pointer items-center gap-3 text-sm">
                  <Checkbox checked={filters.categories.includes(c.slug)} onCheckedChange={() => setFilters({ ...filters, categories: toggle(filters.categories, c.slug) })} />
                  {c.name}
                </label>
              ))}
          </div>
        </div>
      )}
      <div>
        <p className="eyebrow mb-3">Occasion</p>
        <div className="flex flex-wrap gap-2">
          {OCCASIONS.map((o) => {
            const active = filters.occasions.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setFilters({ ...filters, occasions: toggle(filters.occasions, o.id) })}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary",
                )}
              >
                {o.emoji} {o.name}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="eyebrow mb-4">Price</p>
        <Slider
          min={PRICE_MIN}
          max={PRICE_MAX}
          step={10}
          value={filters.price}
          onValueChange={(v) => setFilters({ ...filters, price: [v[0] ?? PRICE_MIN, v[1] ?? PRICE_MAX] })}
        />
        <div className="mt-3 flex justify-between text-sm text-muted-foreground">
          <span>{formatINR(filters.price[0])}</span>
          <span>{formatINR(filters.price[1])}</span>
        </div>
      </div>
      <label className="flex cursor-pointer items-center justify-between text-sm">
        In stock only
        <Switch checked={filters.inStockOnly} onCheckedChange={(v) => setFilters({ ...filters, inStockOnly: v })} />
      </label>
    </div>
  );
}

export function ShopView({ lockedCategory, initialQ, initialOccasion, initialSort }: Props) {
  const products = useVisibleProducts();
  const [filters, setFilters] = useState<ProductFilters>(() => ({
    ...DEFAULT_FILTERS,
    q: initialQ ?? "",
    occasions: initialOccasion ? [initialOccasion] : [],
    sort: normalizeSort(initialSort),
  }));

  // Follow URL changes (header search, occasion menu) while staying on the page.
  useEffect(() => {
    setFilters((f) => ({ ...f, q: initialQ ?? "", occasions: initialOccasion ? [initialOccasion] : f.occasions }));
  }, [initialQ, initialOccasion]);

  const scoped = lockedCategory ? products.filter((p) => p.category === lockedCategory) : products;
  const results = useMemo(() => filterProducts(scoped, filters), [scoped, filters]);

  const activeCount =
    filters.categories.length +
    filters.occasions.length +
    (filters.price[0] !== PRICE_MIN || filters.price[1] !== PRICE_MAX ? 1 : 0) +
    (filters.inStockOnly ? 1 : 0) +
    (filters.q ? 1 : 0);

  const reset = () => setFilters({ ...DEFAULT_FILTERS, sort: filters.sort });

  return (
    <div className="container-page py-10 md:py-14">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1 md:max-w-sm">
          <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            placeholder="Search this collection"
            className="h-11 w-full rounded-full border border-input bg-card pl-11 pr-4 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="flex items-center gap-3 md:ml-auto">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{results.length}</span> gifts
          </p>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="lg:hidden">
                <SlidersHorizontal /> Filters {activeCount > 0 && `(${activeCount})`}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[22rem] overflow-y-auto bg-background p-6">
              <SheetTitle className="mb-6 font-display text-2xl text-plum">Filters</SheetTitle>
              <FilterPanel filters={filters} setFilters={setFilters} lockedCategory={lockedCategory} />
              <Button variant="soft" className="mt-8 w-full" onClick={reset}>Clear filters</Button>
            </SheetContent>
          </Sheet>
          <Select value={filters.sort} onValueChange={(v) => setFilters({ ...filters, sort: normalizeSort(v) })}>
            <SelectTrigger className="h-11 w-48 rounded-full bg-card" aria-label="Sort products">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {activeCount > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {filters.q && (
            <button onClick={() => setFilters({ ...filters, q: "" })} className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs">
              “{filters.q}” <X className="size-3" />
            </button>
          )}
          {filters.occasions.map((o) => (
            <button key={o} onClick={() => setFilters({ ...filters, occasions: toggle(filters.occasions, o) })} className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs">
              {OCCASIONS.find((x) => x.id === o)?.name ?? o} <X className="size-3" />
            </button>
          ))}
          <button onClick={reset} className="text-xs font-medium text-primary underline-offset-4 hover:underline">
            Clear all
          </button>
        </div>
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-[15rem_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-32">
            <FilterPanel filters={filters} setFilters={setFilters} lockedCategory={lockedCategory} />
          </div>
        </aside>
        <div>
          {results.length === 0 ? (
            <EmptyState
              icon={<PackageSearch />}
              title="Nothing here… yet"
              body="No gifts match these filters. Try widening the price range or clearing a filter."
              action={<Button onClick={reset}>Clear filters</Button>}
            />
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6">
              {results.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
