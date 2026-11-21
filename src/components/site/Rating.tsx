import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

export function Rating({ value, reviews, className }: { value: number; reviews?: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-1 text-xs text-muted-foreground", className)}>
      <div className="flex" aria-label={`Rated ${value} out of 5`}>
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={cn("size-3.5", i < Math.round(value) ? "fill-primary text-primary" : "text-lilac")}
          />
        ))}
      </div>
      <span className="font-medium text-foreground">{value.toFixed(1)}</span>
      {reviews !== undefined && <span>({reviews})</span>}
    </div>
  );
}
