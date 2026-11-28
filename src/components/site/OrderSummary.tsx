import { formatINR } from "@/lib/format";
import type { Totals } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export function SummaryRows({
  totals,
  couponCode,
}: {
  totals: Totals;
  couponCode?: string | undefined;
}) {
  return (
    <dl className="mt-4 space-y-2.5 text-sm">
      <Row label="Subtotal" value={formatINR(totals.subtotal)} />
      {totals.discount > 0 && (
        <Row
          label={`Discount${couponCode ? ` (${couponCode})` : ""}`}
          value={`−${formatINR(totals.discount)}`}
          className="text-success"
        />
      )}
      <Row label="Delivery" value={totals.delivery ? formatINR(totals.delivery) : "Free"} />
      {totals.wrap > 0 && <Row label="Gift wrap" value={formatINR(totals.wrap)} />}
      {totals.slotFee > 0 && <Row label="Delivery slot" value={formatINR(totals.slotFee)} />}
      {totals.tax > 0 && <Row label="Tax" value={formatINR(totals.tax)} />}
      <div className="border-t border-border pt-3">
        <Row
          label="Total"
          value={formatINR(totals.total)}
          className="text-base font-semibold text-foreground"
        />
      </div>
    </dl>
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("flex justify-between gap-4 text-foreground/80", className)}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
