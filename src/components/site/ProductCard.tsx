import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Heart, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import { Rating } from "@/components/site/Rating";
import type { Product } from "@/lib/catalog";
import { formatINR } from "@/lib/format";
import { resolveImage } from "@/lib/images";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const { addToCart, toggleWishlist, isWishlisted } = useStore();
  const wished = isWishlisted(product.id);
  const soldOut = product.stock <= 0;
  const needsOptions = product.personalizable || product.sizes.length > 0;

  const tag = product.tags[0];

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: Math.min(index, 8) * 0.05 }}
      className="group relative flex flex-col"
    >
      <div className="relative overflow-hidden rounded-3xl bg-secondary">
        <Link to="/product/$slug" params={{ slug: product.slug }} className="block aspect-[4/5]">
          <img
            src={resolveImage(product.images[0] ?? "")}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
          />
        </Link>
        {tag && (
          <span className="absolute left-3 top-3 rounded-full bg-card/90 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-widest text-primary backdrop-blur">
            {tag === "bestseller" ? "Bestseller" : tag === "new" ? "New" : "Limited"}
          </span>
        )}
        <button
          type="button"
          aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
          onClick={() => {
            const added = toggleWishlist(product.id);
            toast(added ? "Saved to your wishlist" : "Removed from wishlist", {
              description: product.name,
            });
          }}
          className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-card/90 text-primary shadow-soft backdrop-blur transition hover:scale-110"
        >
          <Heart className={cn("size-4", wished && "fill-primary")} />
        </button>
        <div className="absolute inset-x-3 bottom-3 translate-y-3 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 max-md:translate-y-0 max-md:opacity-100">
          {needsOptions ? (
            <Link
              to="/product/$slug"
              params={{ slug: product.slug }}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-card/95 text-sm font-medium text-plum shadow-soft backdrop-blur hover:bg-card"
            >
              Choose options
            </Link>
          ) : (
            <button
              type="button"
              disabled={soldOut}
              onClick={() => {
                addToCart(product);
                toast.success("Added to cart", { description: product.name });
              }}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-plum text-sm font-medium text-plum-foreground shadow-soft transition hover:bg-plum/90 disabled:opacity-60"
            >
              <ShoppingBag className="size-4" />
              {soldOut ? "Sold out" : "Add to cart"}
            </button>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-1 flex-col px-1">
        <Rating value={product.rating} reviews={product.reviews} />
        <Link
          to="/product/$slug"
          params={{ slug: product.slug }}
          className="mt-1.5 font-display text-lg leading-snug text-plum hover:text-primary"
        >
          {product.name}
        </Link>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-semibold text-foreground">{formatINR(product.price)}</span>
          {product.compareAt && (
            <span className="text-sm text-muted-foreground line-through">
              {formatINR(product.compareAt)}
            </span>
          )}
          {product.stock > 0 && product.stock <= 5 && (
            <span className="ml-auto text-xs font-medium text-accent-foreground">
              Only {product.stock} left
            </span>
          )}
        </div>
      </div>
    </motion.article>
  );
}
