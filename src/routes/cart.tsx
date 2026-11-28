import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Gift, ShoppingBag, Tag, Trash2, Truck, X } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/site/EmptyState";
import { SummaryRows } from "@/components/site/OrderSummary";
import { PageHeader } from "@/components/site/PageHeader";
import { QuantityStepper } from "@/components/site/QuantityStepper";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatINR } from "@/lib/format";
import { resolveImage } from "@/lib/images";
import { useValidateCoupon } from "@/lib/api-hooks";
import { deliveryProgress } from "@/lib/pricing";
import { useCartTotals, useStore, type CartLine } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your Cart — Artsheaven" },
      {
        name: "description",
        content: "Review your gifts, add a handwritten card and choose your wrapping.",
      },
      { property: "og:title", content: "Your Cart — Artsheaven" },
      { property: "og:description", content: "Review your gifts before checkout." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CartPage,
});

const CARD_LIMIT = 200;

function CartPage() {
  const {
    cart,
    hydrated,
    cartCount,
    cartSubtotal,
    gift,
    setGift,
    clearCart,
    wraps,
    freeDeliveryThreshold,
  } = useStore();
  const [couponDiscount, setCouponDiscount] = useState(0);
  const totals = useCartTotals({ discount: couponDiscount });
  const navigate = useNavigate();

  return (
    <>
      <PageHeader
        eyebrow="Almost there"
        title={
          <>
            Your <em>cart</em>
          </>
        }
        intro="Wrap it beautifully, add a few heartfelt words, and we'll handle the rest."
      />
      <div className="container-page py-10 md:py-14">
        {!hydrated ? (
          <div className="h-[40vh]" />
        ) : cart.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag />}
            title="Your cart is empty"
            body="Fill it with blooms, chocolates and cuddly things for someone special."
            action={
              <Button asChild>
                <Link to="/shop">Discover gifts</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-10 lg:grid-cols-[1fr_24rem] lg:gap-12">
            <div className="min-w-0 space-y-8">
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {cartCount} item{cartCount === 1 ? "" : "s"}
                  </p>
                  <button
                    onClick={() => {
                      void clearCart();
                      toast("Cart cleared");
                    }}
                    className="text-sm text-muted-foreground underline-offset-4 hover:text-destructive hover:underline"
                  >
                    Clear cart
                  </button>
                </div>
                <FreeDeliveryBar subtotal={cartSubtotal} threshold={freeDeliveryThreshold} />
                <ul className="mt-4 space-y-3">
                  <AnimatePresence initial={false}>
                    {cart.map((line) => (
                      <CartLineRow key={line.lineId} line={line} />
                    ))}
                  </AnimatePresence>
                </ul>
              </section>

              <section className="rounded-3xl border border-border bg-card p-5 md:p-6">
                <p className="flex items-center gap-2 font-display text-xl text-plum">
                  <Gift className="size-5 text-primary" /> Gift wrapping
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {wraps.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setGift({ wrapId: w.id })}
                      aria-pressed={gift.wrapId === w.id}
                      className={cn(
                        "rounded-2xl border-2 p-4 text-left transition",
                        gift.wrapId === w.id
                          ? "border-primary bg-secondary"
                          : "border-border hover:border-lilac",
                      )}
                    >
                      <p className="font-medium">{w.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{w.description}</p>
                      <p className="mt-2 text-sm font-semibold">
                        {w.price ? `+${formatINR(w.price)}` : "Free"}
                      </p>
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-border bg-card p-5 md:p-6">
                <p className="font-display text-xl text-plum">Handwritten greeting card</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Free with every order. We'll write it by hand in lavender ink.
                </p>
                <Textarea
                  value={gift.cardMessage}
                  maxLength={CARD_LIMIT}
                  onChange={(e) => setGift({ cardMessage: e.target.value })}
                  placeholder="Happy birthday! Wishing you a year as lovely as you are…"
                  className="mt-4 min-h-28 rounded-2xl bg-background"
                />
                <div className="mt-1.5 text-right text-xs text-muted-foreground">
                  {gift.cardMessage.length}/{CARD_LIMIT}
                </div>
                <input
                  value={gift.cardFrom}
                  maxLength={40}
                  onChange={(e) => setGift({ cardFrom: e.target.value })}
                  placeholder="From (e.g. With love, Rahul)"
                  className="mt-2 h-11 w-full rounded-full border border-input bg-background px-4 text-sm outline-none focus:border-primary"
                />
              </section>
            </div>

            <aside className="h-fit space-y-4 lg:sticky lg:top-28">
              <CouponBox subtotal={cartSubtotal} onDiscountChange={setCouponDiscount} />
              <div className="rounded-3xl bg-secondary p-6">
                <p className="font-display text-xl text-plum">Order summary</p>
                <SummaryRows totals={totals} couponCode={gift.couponCode} />
                <p className="mt-2 text-xs text-muted-foreground">
                  Delivery slot fees, if any, are added at checkout.
                </p>
                <Button
                  size="lg"
                  variant="hero"
                  className="mt-5 w-full"
                  onClick={() => void navigate({ to: "/checkout" })}
                >
                  Proceed to checkout
                </Button>
                <Button asChild variant="link" className="mt-1 w-full">
                  <Link to="/shop">Continue shopping</Link>
                </Button>
              </div>
            </aside>
          </div>
        )}
      </div>
    </>
  );
}

function FreeDeliveryBar({ subtotal, threshold }: { subtotal: number; threshold: number }) {
  const { remaining, pct } = deliveryProgress(subtotal, threshold);
  return (
    <div className="rounded-2xl bg-secondary px-4 py-3">
      <p className="flex items-center gap-2 text-sm">
        <Truck className="size-4 text-primary" />
        {remaining > 0 ? (
          <span>
            Add <strong>{formatINR(remaining)}</strong> more for free delivery
          </span>
        ) : (
          <span className="font-medium text-success">You've unlocked free delivery 🎉</span>
        )}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-lilac/60">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function CartLineRow({ line }: { line: CartLine }) {
  const { products, updateQty, removeLine, addToCart } = useStore();
  const product = line.productId ? products.find((p) => p.id === line.productId) : undefined;
  const maxQty = product ? Math.max(1, Math.min(10, product.stock)) : 10;
  const outOfStock = product !== undefined && product.stock <= 0;

  const remove = () => {
    void removeLine(line.lineId);
    toast("Removed from cart", {
      description: line.name,
      action: {
        label: "Undo",
        onClick: () => {
          if (product) {
            const [size, personal] = splitDetails(line.details);
            void addToCart(product, {
              qty: line.qty,
              ...(size ? { size } : {}),
              ...(personal ? { personalization: personal } : {}),
            });
          }
        },
      },
    });
  };

  const image = line.image ? resolveImage(line.image) : "";

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -24, transition: { duration: 0.2 } }}
      className="flex gap-4 rounded-3xl border border-border bg-card p-3 sm:p-4"
    >
      {product ? (
        <Link to="/product/$slug" params={{ slug: product.slug }} className="shrink-0">
          <Thumb src={image} alt={line.name} />
        </Link>
      ) : (
        <Thumb src={image} alt={line.name} />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex justify-between gap-2">
          <div className="min-w-0">
            {product ? (
              <Link
                to="/product/$slug"
                params={{ slug: product.slug }}
                className="font-display text-lg leading-snug text-plum hover:text-primary"
              >
                {line.name}
              </Link>
            ) : (
              <p className="font-display text-lg leading-snug text-plum">{line.name}</p>
            )}
            {line.details && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{line.details}</p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">{formatINR(line.unitPrice)} each</p>
          </div>
          <button
            aria-label={`Remove ${line.name}`}
            onClick={remove}
            className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-secondary"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
          {line.kind === "box" ? (
            <span className="text-xs text-muted-foreground">Custom box · qty 1</span>
          ) : (
            <QuantityStepper
              size="sm"
              value={line.qty}
              max={maxQty}
              onChange={(q) => updateQty(line.lineId, q)}
            />
          )}
          <span className="font-semibold">{formatINR(line.unitPrice * line.qty)}</span>
        </div>
        {outOfStock && (
          <p className="mt-2 text-xs font-medium text-destructive">
            This gift just sold out — please remove it to continue.
          </p>
        )}
        {!outOfStock && product && line.qty > product.stock && (
          <p className="mt-2 text-xs font-medium text-destructive">
            Only {product.stock} left — please lower the quantity.
          </p>
        )}
      </div>
    </motion.li>
  );
}

function Thumb({ src, alt }: { src: string; alt: string }) {
  return src ? (
    <img src={src} alt={alt} className="size-20 rounded-2xl object-cover sm:size-24" />
  ) : (
    <div className="grid size-20 place-items-center rounded-2xl bg-secondary text-primary sm:size-24">
      <Gift className="size-7" />
    </div>
  );
}

/** Cart line details are "size · “personal”" (either part optional). */
function splitDetails(details?: string): [string | undefined, string | undefined] {
  if (!details) return [undefined, undefined];
  let size: string | undefined;
  let personal: string | undefined;
  for (const part of details.split(" · ")) {
    const m = /^“(.*)”$/.exec(part);
    if (m) personal = m[1];
    else size = part;
  }
  return [size, personal];
}

interface AppliedCoupon {
  code: string;
  discount: number;
  description: string;
}

function CouponBox({
  subtotal,
  onDiscountChange,
}: {
  subtotal: number;
  onDiscountChange: (discount: number) => void;
}) {
  const { cartCouponCode, setCartCoupon, coupons } = useStore();
  const { mutateAsync: validateCoupon } = useValidateCoupon();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [applied, setApplied] = useState<AppliedCoupon | null>(null);

  // The server owns the applied coupon. Re-validate it whenever the cart total
  // changes so the displayed discount always matches the server's rules.
  useEffect(() => {
    let active = true;
    if (!cartCouponCode) {
      setApplied(null);
      onDiscountChange(0);
      return;
    }
    void validateCoupon({ code: cartCouponCode, subtotal })
      .then((result) => {
        if (!active) return;
        setApplied(result);
        onDiscountChange(result.discount);
      })
      .catch(() => {
        if (!active) return;
        setApplied(null);
        onDiscountChange(0);
      });
    return () => {
      active = false;
    };
  }, [cartCouponCode, subtotal, validateCoupon, onDiscountChange]);

  const apply = async (value: string) => {
    if (!value.trim()) return;
    try {
      const result = await validateCoupon({ code: value.trim().toUpperCase(), subtotal });
      await setCartCoupon(result.code);
      setApplied(result);
      onDiscountChange(result.discount);
      setCode("");
      setError("");
      toast.success(`${result.code} applied`, { description: result.description });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code isn't valid.");
    }
  };

  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Tag className="size-4 text-primary" /> Coupon
      </p>
      {cartCouponCode ? (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl bg-secondary px-4 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-semibold">{cartCouponCode}</p>
            <p className={cn("text-xs", applied ? "text-success" : "text-muted-foreground")}>
              {applied
                ? `${applied.description} · saves ${formatINR(applied.discount)}`
                : "Validating with the server…"}
            </p>
          </div>
          <button
            aria-label="Remove coupon"
            onClick={() => {
              void setCartCoupon(null);
              setApplied(null);
              onDiscountChange(0);
            }}
            className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-card"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ) : (
        <>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void apply(code);
            }}
          >
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError("");
              }}
              placeholder="Enter code"
              className={cn(
                "h-11 min-w-0 flex-1 rounded-full border bg-background px-4 text-sm uppercase outline-none focus:border-primary",
                error ? "border-destructive" : "border-input",
              )}
            />
            <Button type="submit" variant="soft" className="h-11">
              Apply
            </Button>
          </form>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {coupons.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => void apply(c.code)}
                className="rounded-full border border-dashed border-lilac px-3 py-1 text-xs hover:bg-secondary"
                title={c.description}
              >
                {c.code}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
