import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Clock, Gift, HeartHandshake, PenLine, Quote, Truck } from "lucide-react";

import { ProductCard } from "@/components/site/ProductCard";
import { Button } from "@/components/ui/button";
import { OCCASIONS } from "@/lib/catalog";
import { resolveImage, SITE_IMAGES } from "@/lib/images";
import { useStore, useVisibleProducts } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Artsheaven — Flowers, Chocolate Bouquets & Dreamy Gifts" },
      { name: "description", content: "Shop lavender-wrapped flower bouquets, chocolate bouquets, teddies, personalised gifts and hampers from ₹99 to ₹499. Same-day delivery." },
      { property: "og:title", content: "Artsheaven — Gifts that feel like a daydream" },
      { property: "og:description", content: "Bouquets, chocolates, teddies and hampers from ₹99 to ₹499, wrapped in lavender and delivered with love." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const TABS = [
  { id: "best", label: "Bestsellers" },
  { id: "new", label: "New in" },
  { id: "under", label: "Under ₹299" },
] as const;

const testimonials = [
  { quote: "The crochet bouquet made my mum cry happy tears. It's sitting on her bedside six months later.", name: "Ananya, Bengaluru" },
  { quote: "Midnight delivery arrived at 11:48 PM, perfectly wrapped. My girlfriend still talks about it.", name: "Rohan, Mumbai" },
  { quote: "The build-your-own box was so fun to put together — and it looked even better in person.", name: "Meera, Kochi" },
];

function Home() {
  const products = useVisibleProducts();
  const { categories } = useStore();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("best");

  const featured = useMemo(() => {
    if (tab === "new") return [...products].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
    if (tab === "under") return products.filter((p) => p.price < 300).sort((a, b) => b.popularity - a.popularity).slice(0, 8);
    return [...products].sort((a, b) => b.popularity - a.popularity).slice(0, 8);
  }, [products, tab]);

  const visibleCategories = categories.filter((c) => c.visible);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <img src={SITE_IMAGES.hero} alt="Lavender rose bouquet with chocolates and a teddy bear" className="absolute inset-0 h-full w-full object-cover object-right" />
        <div className="absolute inset-0 bg-veil" />
        <div className="container-page relative flex min-h-[78vh] items-center py-20">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="max-w-xl">
            <p className="eyebrow mb-5">Flowers · Chocolates · Cuddles</p>
            <h1 className="text-5xl leading-[0.98] text-plum md:text-7xl">
              Gifts that feel like a <em className="text-primary">daydream.</em>
            </h1>
            <p className="mt-6 max-w-md text-lg text-foreground/75">
              Hand-tied bouquets, chocolate blooms and keepsakes wrapped in lavender — every gift from ₹99 to ₹499.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild variant="hero" size="lg">
                <Link to="/shop">
                  Shop all gifts <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="bg-card/70 backdrop-blur">
                <Link to="/build-a-box">Build a gift box</Link>
              </Button>
            </div>
            <div className="mt-12 flex gap-10 text-sm">
              <div>
                <p className="font-display text-3xl text-plum">4.9★</p>
                <p className="text-muted-foreground">12k+ happy gifters</p>
              </div>
              <div>
                <p className="font-display text-3xl text-plum">2 PM</p>
                <p className="text-muted-foreground">Same-day cut-off</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Occasions */}
      <section className="border-b border-border bg-card">
        <div className="container-page no-scrollbar flex gap-3 overflow-x-auto py-5">
          <span className="eyebrow shrink-0 self-center pr-2">Shop by occasion</span>
          {OCCASIONS.map((o) => (
            <Link
              key={o.id}
              to="/shop"
              search={{ occasion: o.id }}
              className="shrink-0 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium transition hover:border-primary hover:bg-secondary"
            >
              {o.emoji} {o.name}
            </Link>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="container-page py-20 md:py-28">
        <div className="mb-12 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="eyebrow mb-3">The collections</p>
            <h2 className="text-4xl text-plum md:text-5xl">Something for every <em>kind</em> of love</h2>
          </div>
          <Link to="/shop" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:gap-3 transition-all">
            View everything <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">
          {visibleCategories.map((c, i) => (
            <motion.div
              key={c.slug}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
              className={cn(i === 0 && "md:row-span-2")}
            >
              <Link to="/category/$slug" params={{ slug: c.slug }} className="group relative block h-full overflow-hidden rounded-3xl bg-secondary">
                <img
                  src={resolveImage(c.image)}
                  alt={c.name}
                  loading="lazy"
                  className={cn("w-full object-cover transition duration-700 group-hover:scale-105", i === 0 ? "aspect-square md:aspect-auto md:h-full" : "aspect-square")}
                />
                <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-card/90 p-4 backdrop-blur md:inset-x-4 md:bottom-4">
                  <p className="text-[0.7rem] uppercase tracking-widest text-primary">{c.tagline}</p>
                  <p className="mt-1 font-display text-lg leading-tight text-plum md:text-xl">{c.name}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Featured products */}
      <section className="bg-dream py-20 md:py-28">
        <div className="container-page">
          <div className="mb-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="eyebrow mb-3">Most gifted</p>
              <h2 className="text-4xl text-plum md:text-5xl">Picked with love</h2>
            </div>
            <div className="flex rounded-full border border-border bg-card p-1" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition",
                    tab === t.id ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6">
            {featured.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* Build your own box */}
      <section className="container-page py-20 md:py-28">
        <div className="grid items-center gap-10 overflow-hidden rounded-[2.5rem] bg-plum text-plum-foreground md:grid-cols-2">
          <img src={SITE_IMAGES.buildBox} alt="Open gift box surrounded by chocolates, a teddy and dried flowers" loading="lazy" className="h-full min-h-72 w-full object-cover" />
          <div className="p-8 md:p-14">
            <p className="eyebrow text-lilac">New · Build your own</p>
            <h2 className="mt-4 text-4xl md:text-5xl">
              Fill a box with <em className="text-lilac">their</em> favourite things.
            </h2>
            <p className="mt-5 text-plum-foreground/75">
              Choose a box, add truffles, plushies, blooms and keepsakes, then write a note. We'll pack it by hand.
            </p>
            <Button asChild variant="hero" size="lg" className="mt-8">
              <Link to="/build-a-box">
                Start building <Gift />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Promises */}
      <section className="container-page">
        <div className="grid gap-6 border-y border-border py-12 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Truck, title: "Free delivery ₹499+", body: "Flat ₹49 below that, anywhere we deliver." },
            { icon: Clock, title: "Same-day & midnight", body: "Order by 2 PM, or surprise them at midnight." },
            { icon: PenLine, title: "Handwritten cards", body: "Your words, written by hand. Always free." },
            { icon: HeartHandshake, title: "Freshness promise", body: "Not perfect? We replace it, no questions." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-4">
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-secondary text-primary">
                <Icon className="size-5" />
              </div>
              <div>
                <p className="font-display text-lg text-plum">{title}</p>
                <p className="text-sm text-muted-foreground">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="container-page py-20 md:py-28">
        <p className="eyebrow mb-3 text-center">Love notes</p>
        <h2 className="text-center text-4xl text-plum md:text-5xl">From people who gifted</h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.figure
              key={t.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-3xl border border-border bg-card p-8 shadow-soft"
            >
              <Quote className="size-6 text-lilac" />
              <blockquote className="mt-4 font-display text-xl leading-snug text-plum">{t.quote}</blockquote>
              <figcaption className="mt-6 text-sm text-muted-foreground">— {t.name}</figcaption>
            </motion.figure>
          ))}
        </div>
      </section>
    </>
  );
}
