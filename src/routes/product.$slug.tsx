import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Flower2, Heart, MapPin, ShieldCheck, ShoppingBag, Truck } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/site/EmptyState";
import { ProductCard } from "@/components/site/ProductCard";
import { QuantityStepper } from "@/components/site/QuantityStepper";
import { Rating } from "@/components/site/Rating";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { OCCASIONS, SEED_PRODUCTS } from "@/lib/catalog";
import { formatINR } from "@/lib/format";
import { resolveImage } from "@/lib/images";
import { useStore, useVisibleProducts } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/product/$slug")({
  head: ({ params }) => {
    const p = SEED_PRODUCTS.find((x) => x.slug === params.slug);
    const title = p ? `${p.name} — ${formatINR(p.price)} | Artsheaven` : "Gift — Artsheaven";
    const description = p?.description ?? "A dreamy gift from Artsheaven.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: p?.name ?? "Artsheaven gift" },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: ProductPage,
});

interface Review {
  name: string;
  rating: number;
  text: string;
  date: string;
}

const SAMPLE_REVIEWS: Review[] = [
  { name: "Ishita", rating: 5, text: "Even prettier than the photos. The wrapping paper is so soft and the bow was perfect.", date: "2 weeks ago" },
  { name: "Arjun", rating: 5, text: "Arrived right on time for her birthday. The handwritten card was a lovely touch.", date: "1 month ago" },
  { name: "Neha", rating: 4, text: "Gorgeous and well packed. Would love a slightly bigger size option!", date: "1 month ago" },
];

function ProductPage() {
  const { slug } = Route.useParams();
  return <ProductDetail key={slug} slug={slug} />;
}

function ProductDetail({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const { products, hydrated, addToCart, toggleWishlist, isWishlisted, categories } = useStore();
  const visible = useVisibleProducts();
  const product = products.find((p) => p.slug === slug && p.active);

  const [imageIndex, setImageIndex] = useState(0);
  const [sizeIndex, setSizeIndex] = useState(0);
  const [qty, setQty] = useState(1);
  const [personal, setPersonal] = useState("");
  const [personalError, setPersonalError] = useState("");
  const [pincode, setPincode] = useState("");
  const [pinResult, setPinResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [reviews, setReviews] = useState<Review[]>(SAMPLE_REVIEWS);
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(5);

  const related = useMemo(
    () => (product ? visible.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4) : []),
    [visible, product],
  );

  if (!product) {
    if (!hydrated) return <div className="container-page h-[70vh]" />;
    return (
      <div className="container-page py-24">
        <EmptyState
          icon={<Flower2 />}
          title="This gift has floated away"
          body="We couldn't find that product. It may be sold out for the season."
          action={
            <Button asChild>
              <Link to="/shop">Browse all gifts</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const category = categories.find((c) => c.slug === product.category);
  const size = product.sizes[sizeIndex];
  const unitPrice = product.price + (size?.extra ?? 0);
  const wished = isWishlisted(product.id);
  const soldOut = product.stock <= 0;

  const handleAdd = (goToCart: boolean) => {
    if (product.personalizable && !personal.trim()) {
      setPersonalError("Add the name or message you'd like printed.");
      return;
    }
    addToCart(product, {
      qty,
      ...(size ? { size: size.label, sizeExtra: size.extra } : {}),
      ...(product.personalizable ? { personalization: personal.trim() } : {}),
    });
    toast.success(`${qty} × ${product.name} added`, {
      action: { label: "View cart", onClick: () => void navigate({ to: "/cart" }) },
    });
    if (goToCart) void navigate({ to: "/cart" });
  };

  const checkPincode = () => {
    if (!/^[1-9]\d{5}$/.test(pincode)) {
      setPinResult({ ok: false, text: "Enter a valid 6-digit pincode." });
      return;
    }
    const metro = ["1", "4", "5", "6"].includes(pincode[0] ?? "");
    setPinResult({ ok: true, text: metro ? "Same-day delivery available — order before 2 PM." : "Delivers in 1–2 days to this pincode." });
  };

  return (
    <div className="container-page py-8 md:py-12">
      <nav className="mb-6 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-primary">Home</Link> /{" "}
        {category ? (
          <Link to="/category/$slug" params={{ slug: category.slug }} className="hover:text-primary">
            {category.name}
          </Link>
        ) : (
          <Link to="/shop" className="hover:text-primary">Shop</Link>
        )}{" "}
        / <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        {/* Gallery */}
        <div className="flex flex-col-reverse gap-4 md:flex-row">
          <div className="flex gap-3 md:flex-col">
            {product.images.map((img, i) => (
              <button
                key={img + i}
                onClick={() => setImageIndex(i)}
                aria-label={`Show image ${i + 1}`}
                className={cn("size-20 overflow-hidden rounded-2xl border-2 transition", i === imageIndex ? "border-primary" : "border-transparent opacity-70 hover:opacity-100")}
              >
                <img src={resolveImage(img)} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
          <div className="relative flex-1 overflow-hidden rounded-[2rem] bg-secondary">
            <AnimatePresence mode="wait">
              <motion.img
                key={imageIndex}
                src={resolveImage(product.images[imageIndex] ?? product.images[0] ?? "")}
                alt={product.name}
                initial={{ opacity: 0, scale: 1.03 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="aspect-square w-full object-cover"
              />
            </AnimatePresence>
          </div>
        </div>

        {/* Details */}
        <div>
          <Rating value={product.rating} reviews={product.reviews} />
          <h1 className="mt-3 text-4xl leading-tight text-plum md:text-5xl">{product.name}</h1>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-2xl font-semibold">{formatINR(unitPrice)}</span>
            {product.compareAt && <span className="text-lg text-muted-foreground line-through">{formatINR(product.compareAt + (size?.extra ?? 0))}</span>}
            {product.compareAt && (
              <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
                Save {Math.round(((product.compareAt - product.price) / product.compareAt) * 100)}%
              </span>
            )}
          </div>
          <p className="mt-5 text-foreground/75">{product.description}</p>

          <div className="mt-5 flex flex-wrap gap-2">
            {product.occasions.map((o) => {
              const occ = OCCASIONS.find((x) => x.id === o);
              return occ ? (
                <Link key={o} to="/shop" search={{ occasion: o }} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground hover:bg-lilac">
                  {occ.emoji} {occ.name}
                </Link>
              ) : null;
            })}
          </div>

          {product.sizes.length > 0 && (
            <div className="mt-8">
              <p className="eyebrow mb-3">Size</p>
              <div className="flex gap-3">
                {product.sizes.map((s, i) => (
                  <button
                    key={s.label}
                    onClick={() => setSizeIndex(i)}
                    className={cn(
                      "rounded-2xl border-2 px-5 py-3 text-left transition",
                      i === sizeIndex ? "border-primary bg-secondary" : "border-border bg-card hover:border-lilac",
                    )}
                  >
                    <p className="font-medium">{s.label}</p>
                    <p className="text-xs text-muted-foreground">{s.extra ? `+${formatINR(s.extra)}` : "Included"}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {product.personalizable && (
            <div className="mt-8">
              <label htmlFor="personal" className="eyebrow mb-3 block">
                Personalise it
              </label>
              <input
                id="personal"
                value={personal}
                maxLength={24}
                onChange={(e) => {
                  setPersonal(e.target.value);
                  setPersonalError("");
                }}
                placeholder="e.g. Aanya · Forever 14.02"
                className={cn("h-12 w-full rounded-2xl border bg-card px-4 outline-none focus:border-primary", personalError ? "border-destructive" : "border-input")}
              />
              <div className="mt-1.5 flex justify-between text-xs">
                <span className="text-destructive">{personalError}</span>
                <span className="text-muted-foreground">{personal.length}/24</span>
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <QuantityStepper value={qty} onChange={setQty} max={Math.max(1, Math.min(10, product.stock))} />
            <Button size="lg" variant="plum" className="flex-1" disabled={soldOut} onClick={() => handleAdd(false)}>
              <ShoppingBag /> {soldOut ? "Sold out" : "Add to cart"}
            </Button>
            <Button
              size="lg"
              variant="outline"
              aria-label={wished ? "Remove from wishlist" : "Save to wishlist"}
              onClick={() => {
                const added = toggleWishlist(product.id);
                toast(added ? "Saved to your wishlist" : "Removed from wishlist");
              }}
              className="w-12 px-0"
            >
              <Heart className={cn(wished && "fill-primary text-primary")} />
            </Button>
          </div>
          <Button size="lg" variant="hero" className="mt-3 w-full" disabled={soldOut} onClick={() => handleAdd(true)}>
            Buy now
          </Button>
          {product.stock > 0 && product.stock <= 5 && <p className="mt-3 text-sm font-medium text-accent-foreground">Hurry — only {product.stock} left in stock.</p>}

          <div className="mt-8 rounded-3xl border border-border bg-card p-5">
            <p className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="size-4 text-primary" /> Check delivery
            </p>
            <div className="mt-3 flex gap-2">
              <input
                value={pincode}
                inputMode="numeric"
                maxLength={6}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && checkPincode()}
                placeholder="Enter pincode"
                className="h-11 flex-1 rounded-full border border-input bg-background px-4 text-sm outline-none focus:border-primary"
              />
              <Button variant="soft" className="h-11" onClick={checkPincode}>Check</Button>
            </div>
            {pinResult && <p className={cn("mt-2 text-sm", pinResult.ok ? "text-success" : "text-destructive")}>{pinResult.text}</p>}
            <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <p className="flex items-center gap-2"><Truck className="size-4 text-primary" /> Free delivery above ₹499</p>
              <p className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /> Freshness guaranteed</p>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="details" className="mt-16">
        <TabsList className="h-auto rounded-full bg-secondary p-1">
          <TabsTrigger value="details" className="rounded-full px-5 py-2">Details</TabsTrigger>
          <TabsTrigger value="delivery" className="rounded-full px-5 py-2">Delivery & care</TabsTrigger>
          <TabsTrigger value="reviews" className="rounded-full px-5 py-2">Reviews ({reviews.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="mt-8 max-w-2xl">
          <ul className="grid gap-3 sm:grid-cols-2">
            {product.highlights.map((h) => (
              <li key={h} className="flex items-center gap-3 rounded-2xl bg-card p-4 text-sm">
                <Check className="size-4 text-primary" /> {h}
              </li>
            ))}
          </ul>
        </TabsContent>
        <TabsContent value="delivery" className="mt-8 max-w-2xl space-y-4 text-sm text-foreground/80">
          <p>Orders placed before 2 PM are delivered the same day in metro cities. Choose a morning, afternoon, evening or midnight-surprise slot at checkout.</p>
          <p>Fresh flowers: trim stems at an angle, change water daily and keep away from direct sun. Chocolates are best kept cool and enjoyed within 10 days.</p>
          <p>Every order includes a free handwritten greeting card — add your message in the cart.</p>
        </TabsContent>
        <TabsContent value="reviews" className="mt-8 grid gap-10 md:grid-cols-[1fr_22rem]">
          <div className="space-y-4">
            {reviews.map((r, i) => (
              <div key={i} className="rounded-3xl border border-border bg-card p-6">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{r.name}</p>
                  <span className="text-xs text-muted-foreground">{r.date}</span>
                </div>
                <Rating value={r.rating} className="mt-1" />
                <p className="mt-3 text-sm text-foreground/80">{r.text}</p>
              </div>
            ))}
          </div>
          <form
            className="h-fit rounded-3xl bg-secondary p-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (reviewText.trim().length < 10) {
                toast.error("Please write at least 10 characters.");
                return;
              }
              setReviews([{ name: "You", rating: reviewRating, text: reviewText.trim(), date: "Just now" }, ...reviews]);
              setReviewText("");
              toast.success("Thanks for your review 💜");
            }}
          >
            <p className="font-display text-xl text-plum">Write a review</p>
            <div className="mt-4 flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setReviewRating(n)} aria-label={`${n} stars`} className={cn("text-2xl", n <= reviewRating ? "text-primary" : "text-lilac")}>
                  ★
                </button>
              ))}
            </div>
            <Textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="What did you love?" className="mt-3 min-h-24 rounded-2xl bg-card" />
            <Button type="submit" className="mt-4 w-full">Post review</Button>
          </form>
        </TabsContent>
      </Tabs>

      {related.length > 0 && (
        <section className="mt-24">
          <h2 className="text-3xl text-plum md:text-4xl">You may also love</h2>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6">
            {related.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
