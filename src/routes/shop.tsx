import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { PageHeader } from "@/components/site/PageHeader";
import { ShopView } from "@/components/site/ShopView";
import { OCCASIONS } from "@/lib/catalog";

const searchSchema = z.object({
  q: z.string().optional(),
  occasion: z.string().optional(),
  sort: z.string().optional(),
});

export const Route = createFileRoute("/shop")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Shop All Gifts — Artsheaven" },
      {
        name: "description",
        content:
          "Browse every Artsheaven gift: fresh and forever bouquets, chocolate bouquets, teddies, personalised gifts and hampers, ₹99–₹499.",
      },
      { property: "og:title", content: "Shop All Gifts — Artsheaven" },
      {
        property: "og:description",
        content:
          "Every bouquet, teddy and hamper in one dreamy place. Filter by occasion, price and more.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShopPage,
});

function ShopPage() {
  const { q, occasion, sort } = Route.useSearch();
  const occasionName = OCCASIONS.find((o) => o.id === occasion)?.name;
  return (
    <>
      <PageHeader
        eyebrow="Shop all"
        title={
          occasionName ? (
            <>
              Gifts for <em>{occasionName.toLowerCase()}</em>
            </>
          ) : (
            <>
              Every little <em>wonder</em>
            </>
          )
        }
        intro="Bouquets that bloom, chocolates that charm and cuddles that last — all between ₹99 and ₹499."
      />
      <ShopView initialQ={q} initialOccasion={occasion} initialSort={sort} />
    </>
  );
}
