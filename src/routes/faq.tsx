import { createFileRoute, Link } from "@tanstack/react-router";

import { PageHeader } from "@/components/site/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FAQS } from "@/lib/catalog";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Artsheaven" },
      {
        name: "description",
        content: "Answers about delivery, personalisation, orders and gifting.",
      },
    ],
  }),
  component: FaqPage,
});

function FaqPage() {
  return (
    <>
      <PageHeader
        eyebrow="Good to know"
        title={
          <>
            Frequently asked <em>questions</em>
          </>
        }
        intro="Everything you might want to know before sending a little joy."
      />
      <div className="container-page max-w-3xl py-12 md:py-16">
        <Accordion type="single" collapsible className="space-y-3">
          {FAQS.map((group) => (
            <div key={group.group}>
              <h2 className="mb-3 mt-6 font-display text-xl text-plum first:mt-0">{group.group}</h2>
              {group.items.map((item) => (
                <AccordionItem
                  key={item.q}
                  value={item.q}
                  className="rounded-2xl border border-border bg-card px-5"
                >
                  <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </div>
          ))}
        </Accordion>

        <div className="mt-12 rounded-3xl bg-secondary p-8 text-center">
          <h2 className="font-display text-2xl text-plum">Still curious?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We're happy to help you pick the perfect gift.
          </p>
          <Button asChild variant="hero" className="mt-5">
            <Link to="/contact">Get in touch</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
