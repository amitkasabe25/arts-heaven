import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, Leaf, PenLine, Sparkles } from "lucide-react";

import { PageHeader } from "@/components/site/PageHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About us — Artsheaven" },
      {
        name: "description",
        content:
          "The story behind Artsheaven: hand-tied gifts, thoughtful details and same-day delivery.",
      },
    ],
  }),
  component: AboutPage,
});

const VALUES = [
  {
    icon: Heart,
    title: "Made with feeling",
    body: "Every bouquet is hand-tied and every box is packed by a real person who cares how it lands.",
  },
  {
    icon: Leaf,
    title: "Fresh, always",
    body: "Flowers are sourced the morning they ship. If it wouldn't sit proudly on our own table, it doesn't leave the studio.",
  },
  {
    icon: PenLine,
    title: "The little details",
    body: "A handwritten card, a ribbon that matches, a note slipped in at the last moment — that's where the magic lives.",
  },
  {
    icon: Sparkles,
    title: "For every occasion",
    body: "Birthdays, quiet Tuesdays, big milestones and 'just because'. There's always a reason to send something lovely.",
  },
];

function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="Our story"
        title={
          <>
            Gifts that feel <em>personal</em>
          </>
        }
        intro="Artsheaven began with a simple idea: sending a gift should feel as good as receiving one."
      />
      <div className="container-page py-12 md:py-16">
        <div className="mx-auto max-w-2xl space-y-5 text-base leading-relaxed text-muted-foreground">
          <p>
            We started in a small lavender-painted studio with a pile of ribbons, a few dozen stems
            and a stubborn belief that a gift carries more than its price tag. Word spread, and
            today we hand-pack thousands of little moments of joy every month.
          </p>
          <p>
            Whether it's a bouquet that smells like someone's favourite morning, a box of chocolates
            with a note in your handwriting, or a plushie that becomes a permanent fixture on a
            shelf — we treat every order like it's going to someone we know.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-3xl border border-border bg-card p-6">
              <Icon className="size-6 text-primary" />
              <h2 className="mt-4 font-display text-xl text-plum">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 rounded-3xl bg-secondary p-8 text-center md:p-12">
          <h2 className="font-display text-3xl text-plum">Ready to make someone's day?</h2>
          <Button asChild size="lg" variant="hero" className="mt-6">
            <Link to="/shop">Explore the collection</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
