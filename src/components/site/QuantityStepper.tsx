import { Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

interface Props {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  size?: "sm" | "md";
  className?: string;
}

export function QuantityStepper({ value, onChange, min = 1, max = 10, size = "md", className }: Props) {
  const btn = size === "sm" ? "size-7" : "size-10";
  return (
    <div className={cn("inline-flex items-center rounded-full border border-border bg-card", className)}>
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className={cn(btn, "grid place-items-center rounded-full text-foreground transition hover:bg-secondary disabled:opacity-40")}
      >
        <Minus className="size-3.5" />
      </button>
      <span className={cn("min-w-8 text-center font-medium tabular-nums", size === "sm" ? "text-sm" : "text-base")}>{value}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className={cn(btn, "grid place-items-center rounded-full text-foreground transition hover:bg-secondary disabled:opacity-40")}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}
