import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Flower2 } from "lucide-react";

import { EmptyState } from "@/components/site/EmptyState";
import { ShopView } from "@/components/site/ShopView";
import { Button } from "@/components/ui/button";
import { SEED_CATEGORIES } from "@/lib/catalog";
import { resolveImage } from "@/lib/images";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/category/$slug")({
  head: ({ params }) => {
    const c = SEED_CATEGORIES.find((x) => x.slug === params.slug);
    const title = c ? `${c.name} — Artsheaven` : "Gift Collection — Artsheaven";
    const description = c?.description ?? "Explore a dreamy Artsheaven gift collection.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const { categories, hydrated } = useStore();
  const category = categories.find((c) => c.slug === slug && c.visible);

  if (!category) {
    if (!hydrated) return <div className="container-page h-96" />;
    return (
      <div className="container-page py-24">
        <EmptyState
          icon={<Flower2 />}
          title="Collection not found"
          body="This collection may have moved or is resting for the season."
          action={
            <Button asChild>
              <Link to="/shop">Browse all gifts</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const others = categories.filter((c) => c.visible && c.slug !== slug);

  return (
    <>
      <section className="bg-dream border-b border-border">
        <div className="container-page grid items-center gap-10 py-12 md:grid-cols-[1.2fr_1fr] md:py-16">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <nav className="mb-6 text-xs text-muted-foreground">
              <Link to="/" className="hover:text-primary">Home</Link> / <Link to="/shop" className="hover:text-primary">Shop</Link> / <span className="text-foreground">{category.name}</span>
            </nav>
            <p className="eyebrow mb-4">{category.tagline}</p>
            <h1 className="text-4xl leading-[1.05] text-plum md:text-6xl">{category.name}</h1>
            <p className="mt-5 max-w-lg text-lg text-muted-foreground">{category.description}</p>
            <div className="mt-8 flex flex-wrap gap-2">
              {others.map((c) => (
                <Link key={c.slug} to="/category/$slug" params={{ slug: c.slug }} className="rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium hover:border-primary">
                  {c.name}
                </Link>
              ))}
            </div>
          </motion.div>
          <motion.img
            key={category.slug}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7 }}
            src={resolveImage(category.image)}
            alt={category.name}
            className="mx-auto aspect-square w-full max-w-sm rounded-[2.5rem] object-cover shadow-lift"
          />
        </div>
      </section>
      <ShopView key={category.slug} lockedCategory={category.slug} />
    </>
  );
}
