import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, ShoppingBag } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/site/PageHeader";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/format";
import { resolveImage } from "@/lib/images";
import { useStore, useVisibleProducts } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/build-a-box")({
  head: () => ({
    meta: [
      { title: "Build your own gift box — Artsheaven" },
      {
        name: "description",
        content: "Pick a size, fill it with treats and keepsakes, and we'll wrap it beautifully.",
      },
    ],
  }),
  component: BuildABoxPage,
});

interface BoxSize {
  id: string;
  capacity: number;
  price: number;
}

function boxSizesFromSettings(settings: Record<string, unknown>): BoxSize[] {
  const value = settings["public.build_a_box"];
  if (!value || typeof value !== "object") return [];
  const sizes = (value as { sizes?: unknown }).sizes;
  if (!Array.isArray(sizes)) return [];
  return sizes
    .filter(
      (size): size is BoxSize =>
        !!size &&
        typeof size === "object" &&
        typeof (size as BoxSize).id === "string" &&
        typeof (size as BoxSize).capacity === "number",
    )
    .map((size) => ({ id: size.id, capacity: size.capacity, price: Number(size.price) || 0 }));
}

function BuildABoxPage() {
  const { settings, addToCart, cartCount } = useStore();
  const navigate = useNavigate();
  const visible = useVisibleProducts();
  const sizes = useMemo(() => boxSizesFromSettings(settings), [settings]);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selected, setSelected] = useState<string[]>([]);

  const picks = useMemo(
    () => visible.filter((product) => selected.includes(product.id)),
    [visible, selected],
  );
  const picksTotal = picks.reduce((total, product) => total + product.price, 0);
  const size = sizes.find((s) => s.id === selectedSize);
  const capacity = size?.capacity ?? 0;
  const atCapacity = capacity > 0 && picks.length >= capacity;

  // Curated add-on candidates: boxes, chocolates, candles and keepsakes. If a
  // category slug changes, the filter simply shows fewer items rather than
  // inventing products locally.
  const candidates = useMemo(() => {
    const keywords = ["chocolat", "sweet", "box", "candle", "hamper", "keepsake", "bloom"];
    return visible.filter((product) => {
      const haystack =
        `${product.name} ${product.category} ${product.highlights.join(" ")}`.toLowerCase();
      return keywords.some((keyword) => haystack.includes(keyword));
    });
  }, [visible]);

  const toggle = (id: string) => {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (atCapacity) {
        toast.error(`This box holds ${capacity} items. Remove one first.`);
        return current;
      }
      return [...current, id];
    });
  };

  const addAll = async () => {
    if (picks.length === 0) {
      toast.error("Pick at least one treat for your box");
      return;
    }
    for (const product of picks) {
      await addToCart(product, { qty: 1 });
    }
    setSelected([]);
    toast.success("Your box is in the cart", {
      description: `${picks.length} item${picks.length === 1 ? "" : "s"} added`,
      action: { label: "View cart", onClick: () => void navigate({ to: "/cart" }) },
    });
  };

  return (
    <>
      <PageHeader
        eyebrow="Made by you"
        title={
          <>
            Build your own <em>gift box</em>
          </>
        }
        intro="Choose a box, fill it with the things they love, and we'll tie it all together with a ribbon and a handwritten note."
      />

      <div className="container-page py-10 md:py-14">
        <section>
          <h2 className="font-display text-2xl text-plum">1. Choose a box</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {sizes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Box options are being updated. Please check back shortly.
              </p>
            ) : (
              sizes.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setSelectedSize(option.id);
                    setSelected([]);
                  }}
                  className={cn(
                    "rounded-3xl border-2 p-5 text-left transition",
                    selectedSize === option.id
                      ? "border-primary bg-secondary"
                      : "border-border hover:border-lilac",
                  )}
                >
                  <span className="flex items-center justify-between">
                    <span className="font-display text-lg capitalize text-plum">{option.id}</span>
                    {selectedSize === option.id && <Check className="size-5 text-primary" />}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    Holds up to {option.capacity} items
                  </span>
                  <span className="mt-2 block text-sm font-semibold">
                    Box from {formatINR(option.price)}
                  </span>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl text-plum">2. Fill it with favourites</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {capacity > 0
              ? `${Math.max(0, capacity - picks.length)} slot${capacity - picks.length === 1 ? "" : "s"} left in your ${size?.id} box.`
              : "Add as many treats as you like."}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {candidates.map((product) => {
              const isPicked = selected.includes(product.id);
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => toggle(product.id)}
                  disabled={!isPicked && atCapacity}
                  className={cn(
                    "group rounded-3xl border-2 bg-card p-3 text-left transition disabled:opacity-50",
                    isPicked ? "border-primary" : "border-border hover:border-lilac",
                  )}
                >
                  <div className="relative aspect-square overflow-hidden rounded-2xl bg-secondary">
                    <img
                      src={resolveImage(product.images[0] ?? "")}
                      alt={product.name}
                      loading="lazy"
                      className="size-full object-cover transition duration-500 group-hover:scale-105"
                    />
                    {isPicked && (
                      <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-4" />
                      </span>
                    )}
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm font-medium text-plum">{product.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{formatINR(product.price)}</p>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <div className="sticky bottom-4 z-20 mx-auto w-[min(92%,42rem)]">
        <div className="flex items-center gap-4 rounded-full border border-border bg-card/95 p-3 pl-5 shadow-soft backdrop-blur">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {picks.length === 0
                ? "Your box is empty"
                : `${picks.length} item${picks.length === 1 ? "" : "s"} selected`}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatINR(picksTotal)}
              {size ? ` + ${formatINR(size.price)} box` : ""} · cart has {cartCount} item
              {cartCount === 1 ? "" : "s"}
            </p>
          </div>
          <Button variant="hero" onClick={() => void addAll()} disabled={picks.length === 0}>
            <ShoppingBag className="size-4" /> Add to cart
          </Button>
        </div>
      </div>

      <div className="container-page pb-10 text-center text-sm text-muted-foreground">
        <Link to="/cart" className="hover:text-primary hover:underline">
          Already have a box in your cart? View it
        </Link>
      </div>
    </>
  );
}
