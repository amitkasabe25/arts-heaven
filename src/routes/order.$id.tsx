import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { CalendarHeart, CheckCircle2, Gift, MapPin, PackageSearch, Wallet } from "lucide-react";

import { EmptyState } from "@/components/site/EmptyState";
import { SummaryRows } from "@/components/site/OrderSummary";
import { Button } from "@/components/ui/button";
import { useOrder } from "@/lib/api-hooks";
import { ORDER_STATUSES } from "@/lib/catalog";
import { formatDate, formatINR } from "@/lib/format";
import { resolveImage } from "@/lib/images";
import { mapOrder } from "@/lib/mappers";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/order/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Order ${params.id} — Artsheaven` },
      { name: "description", content: "Your Artsheaven order details." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrderPage,
});

function OrderPage() {
  const { id } = Route.useParams();
  const { wraps, slots } = useStore();
  const orderQuery = useOrder(id);
  const order = orderQuery.data ? mapOrder(orderQuery.data, wraps, slots) : null;

  if (orderQuery.isLoading) return <div className="container-page h-[70vh]" />;

  if (!order) {
    return (
      <div className="container-page py-24">
        <EmptyState
          icon={<PackageSearch />}
          title="We couldn't find that order"
          body="Check the link, or sign in with the account you used to place the order. Guests can look up an order from the same browser where it was placed."
          action={
            <Button asChild>
              <Link to="/shop">Keep shopping</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const slot = slots.find((s) => s.id === order.delivery.slotId);
  const wrap = wraps.find((w) => w.id === order.giftWrapId);
  const status = ORDER_STATUSES.find((s) => s.id === order.status)?.label ?? order.status;
  const totals = { ...order.totals, tax: order.totals.tax ?? 0 };

  return (
    <div className="container-page max-w-4xl py-10 md:py-16">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
          className="mx-auto grid size-20 place-items-center rounded-full bg-secondary text-primary"
        >
          <CheckCircle2 className="size-10" />
        </motion.div>
        <p className="eyebrow mt-6">Order {order.id}</p>
        <h1 className="mt-2 text-4xl text-plum md:text-5xl">
          Thank you, {order.customer.name.split(" ")[0]}!
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
          Your gift for <strong className="text-foreground">{order.recipient.name}</strong> is being
          lovingly prepared. A confirmation has been sent to {order.customer.email}.
        </p>
      </motion.div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <InfoCard icon={<CalendarHeart />} title="Delivery">
          {order.delivery.date ? formatDate(order.delivery.date) : "To be confirmed"}
          <br />
          {slot
            ? `${slot.label} · ${slot.window}`
            : order.delivery.slotId || "Slot to be confirmed"}
        </InfoCard>
        <InfoCard icon={<MapPin />} title="Deliver to">
          {order.recipient.name}
          <br />
          {order.recipient.address}, {order.recipient.city} {order.recipient.pincode}
        </InfoCard>
        <InfoCard icon={<Wallet />} title="Payment">
          {order.paymentMethod}
          <br />
          Status: {status}
        </InfoCard>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_20rem]">
        <div className="rounded-3xl border border-border bg-card p-5 md:p-6">
          <p className="font-display text-xl text-plum">Items</p>
          <ul className="mt-4 space-y-3">
            {order.lines.map((l, i) => (
              <li key={`${l.name}-${i}`} className="flex items-center gap-3">
                {l.image ? (
                  <img
                    src={resolveImage(l.image)}
                    alt=""
                    className="size-14 rounded-xl object-cover"
                  />
                ) : (
                  <div className="grid size-14 place-items-center rounded-xl bg-secondary text-primary">
                    <Gift className="size-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">{l.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {l.qty} × {formatINR(l.unitPrice)}
                    {l.details ? ` · ${l.details}` : ""}
                  </p>
                </div>
                <span className="text-sm tabular-nums">{formatINR(l.qty * l.unitPrice)}</span>
              </li>
            ))}
          </ul>
          {(wrap || order.cardMessage) && (
            <div className="mt-5 space-y-2 rounded-2xl bg-secondary p-4 text-sm">
              {wrap && (
                <p>
                  🎁 Wrapped in <strong>{wrap.name}</strong>
                </p>
              )}
              {order.cardMessage && (
                <p className="whitespace-pre-line italic text-foreground/80">
                  💌 “{order.cardMessage}”
                </p>
              )}
            </div>
          )}
        </div>
        <div className="h-fit rounded-3xl bg-secondary p-6">
          <p className="font-display text-xl text-plum">Payment summary</p>
          <SummaryRows totals={totals} />
        </div>
      </div>

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Button asChild size="lg" variant="hero">
          <Link to="/shop">Send another gift</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link to="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <p className="flex items-center gap-2 text-sm font-medium text-primary [&_svg]:size-4">
        {icon} {title}
      </p>
      <p className="mt-2 text-sm text-foreground/80">{children}</p>
    </div>
  );
}
