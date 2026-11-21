import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, ShoppingBag, X } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/site/EmptyState";
import { PageHeader } from "@/components/site/PageHeader";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/format";
import { resolveImage } from "@/lib/images";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/wishlist")({
  head: () => ({
    meta: [
      { title: "My Wishlist — Artsheaven" },
      { name: "description", content: "The bouquets, teddies and hampers you've saved for later at Artsheaven." },
      { property: "og:title", content: "My Wishlist — Artsheaven" },
      { property: "og:description", content: "Gifts saved for the perfect moment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WishlistPage,
});

function WishlistPage() {
  const { wishlist, products, toggleWishlist, addToCart, hydrated } = useStore();
  const items = wishlist.map((id) => products.find((p) => p.id === id)).filter((p) => p !== undefined);

  const moveAll = () => {
    const simple = items.filter((p) => !p.personalizable && p.sizes.length === 0 && p.stock > 0);
    simple.forEach((p) => addToCart(p));
    toast.success(`${simple.length} gift${simple.length === 1 ? "" : "s"} added to cart`, {
      description: simple.length < items.length ? "Gifts with options need to be added from their page." : undefined,
    });
  };

  return (
    <>
      <PageHeader eyebrow="Saved with love" title={<>Your <em>wishlist</em></>} intro="Keep an eye on the gifts you adore — they're saved on this device." />
      <div className="container-page py-12">
        {!hydrated ? null : items.length === 0 ? (
          <EmptyState
            icon={<Heart />}
            title="No saved gifts yet"
            body="Tap the heart on any gift to save it here for later."
            action={
              <Button asChild>
                <Link to="/shop">Discover gifts</Link>
              </Button>
            }
          />
        ) : (
          <>
            <div className="mb-8 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{items.length} saved</p>
              <Button variant="soft" onClick={moveAll}>
                <ShoppingBag /> Add all to cart
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {items.map((p) => {
                const needsOptions = p.personalizable || p.sizes.length > 0;
                return (
                  <div key={p.id} className="flex gap-5 rounded-3xl border border-border bg-card p-4">
                    <Link to="/product/$slug" params={{ slug: p.slug }} className="shrink-0">
                      <img src={resolveImage(p.images[0] ?? "")} alt={p.name} className="size-28 rounded-2xl object-cover" />
                    </Link>
                    <div className="flex flex-1 flex-col">
                      <div className="flex justify-between gap-3">
                        <Link to="/product/$slug" params={{ slug: p.slug }} className="font-display text-lg text-plum hover:text-primary">
                          {p.name}
                        </Link>
                        <button
                          aria-label="Remove from wishlist"
                          onClick={() => {
                            toggleWishlist(p.id);
                            toast("Removed from wishlist", { description: p.name });
                          }}
                          className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-secondary"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                      <p className="mt-1 font-semibold">{formatINR(p.price)}</p>
                      <p className="text-xs text-muted-foreground">{p.stock > 0 ? "In stock" : "Sold out"}</p>
                      <div className="mt-auto pt-3">
                        {needsOptions ? (
                          <Button asChild size="sm" variant="outline">
                            <Link to="/product/$slug" params={{ slug: p.slug }}>Choose options</Link>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            disabled={p.stock <= 0}
                            onClick={() => {
                              addToCart(p);
                              toast.success("Added to cart", { description: p.name });
                            }}
                          >
                            <ShoppingBag /> Add to cart
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}
