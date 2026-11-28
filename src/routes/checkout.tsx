import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Banknote, CreditCard, Gift, Lock, ShoppingBag, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/site/EmptyState";
import { SummaryRows } from "@/components/site/OrderSummary";
import { Button } from "@/components/ui/button";
import { useCheckoutQuote, useCreatePayment, useVerifyPayment } from "@/lib/api-hooks";
import type { ApiCheckoutQuote } from "@/lib/api-types";
import { formatINR } from "@/lib/format";
import { resolveImage } from "@/lib/images";
import { mapQuote } from "@/lib/mappers";
import { EMPTY_TOTALS } from "@/lib/pricing";
import { useCartTotals, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — Artsheaven" },
      { name: "description", content: "Choose a delivery date and slot, and send your gift." },
      { property: "og:title", content: "Checkout — Artsheaven" },
      { property: "og:description", content: "Secure checkout for your Artsheaven gift." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CheckoutPage,
});

type PaymentId = "RAZORPAY" | "CASHFREE" | "COD";

const PAYMENT_METHODS = [
  {
    id: "RAZORPAY",
    label: "Pay online",
    hint: "UPI, cards & wallets · Razorpay",
    icon: CreditCard,
  },
  {
    id: "CASHFREE",
    label: "Pay online",
    hint: "UPI, cards & wallets · Cashfree",
    icon: Smartphone,
  },
  { id: "COD", label: "Cash on delivery", hint: "Pay when it arrives", icon: Banknote },
] as const satisfies ReadonlyArray<{
  id: PaymentId;
  label: string;
  hint: string;
  icon: typeof CreditCard;
}>;

interface FormState {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  recipientName: string;
  recipientPhone: string;
  address: string;
  city: string;
  pincode: string;
  date: string;
  slotId: string;
  payment: PaymentId;
  saveAddress: boolean;
}

type Errors = Partial<Record<keyof FormState, string | undefined>>;

function isoDate(d: Date): string {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function earliestDate(): string {
  return isoDate(new Date());
}

function latestDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return isoDate(d);
}

const PHONE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PIN_RE = /^[1-9]\d{5}$/;

function validate(f: FormState, validSlotIds: string[]): Errors {
  const e: Errors = {};
  if (f.customerName.trim().length < 2) e.customerName = "Enter your name.";
  if (!EMAIL_RE.test(f.customerEmail.trim())) e.customerEmail = "Enter a valid email.";
  if (!PHONE_RE.test(f.customerPhone)) e.customerPhone = "Enter a 10-digit mobile number.";
  if (f.recipientName.trim().length < 2) e.recipientName = "Who is this gift for?";
  if (!PHONE_RE.test(f.recipientPhone)) e.recipientPhone = "Enter a 10-digit mobile number.";
  if (f.address.trim().length < 8) e.address = "Enter the full street address.";
  if (f.city.trim().length < 2) e.city = "Enter the city.";
  if (!PIN_RE.test(f.pincode)) e.pincode = "Enter a valid 6-digit pincode.";
  if (!f.date || f.date < earliestDate() || f.date > latestDate())
    e.date = "Pick a date within the next 30 days.";
  if (!validSlotIds.includes(f.slotId)) e.slotId = "Choose a delivery slot.";
  return e;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("Payments are only available in the browser"));
      return;
    }
    if (document.querySelector(`script[data-payment-sdk="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset["paymentSdk"] = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the payment provider script"));
    document.head.appendChild(script);
  });
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

type RazorpayCtor = new (options: Record<string, unknown>) => { open: () => void };
type CashfreeCtor = new (options: { mode: string }) => {
  checkout: (options: { paymentSessionId: string; redirectTarget: string }) => Promise<unknown>;
};

function CheckoutPage() {
  const {
    cart,
    hydrated,
    gift,
    profile,
    products,
    slots,
    wraps,
    cartCouponCode,
    placeOrder,
    setProfile,
    isAuthenticated,
  } = useStore();
  const navigate = useNavigate();
  const { mutateAsync: requestQuote } = useCheckoutQuote();
  const createPayment = useCreatePayment();
  const verifyPayment = useVerifyPayment();

  const [form, setForm] = useState<FormState>(() => ({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    recipientName: "",
    recipientPhone: "",
    address: "",
    city: "",
    pincode: "",
    date: "",
    slotId: "",
    payment: "RAZORPAY",
    saveAddress: true,
  }));
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [quote, setQuote] = useState<ApiCheckoutQuote | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    const addr = profile.addresses[0];
    setForm((f) => ({
      ...f,
      date: f.date || earliestDate(),
      slotId: f.slotId || slots[0]?.id || "",
      customerName: f.customerName || (profile.name === "Guest Gifter" ? "" : profile.name),
      customerEmail: f.customerEmail || (profile.email === "you@example.com" ? "" : profile.email),
      customerPhone: f.customerPhone || profile.phone,
      ...(addr && !f.address
        ? {
            recipientName: addr.name,
            recipientPhone: addr.phone,
            address: addr.address,
            city: addr.city,
            pincode: addr.pincode,
          }
        : {}),
    }));
  }, [hydrated, profile, slots]);

  const wrap = wraps.find((w) => w.id === gift.wrapId);
  const slot = slots.find((s) => s.id === form.slotId);
  const primaryAddress = profile.addresses[0];
  const estimate = useCartTotals({
    wrapId: gift.wrapId,
    ...(slot ? { slotId: slot.id } : {}),
  });
  const totals = quote ? mapQuote(quote) : estimate;

  // The server is the only source of truth for totals. Re-quote whenever any
  // pricing input changes; the button stays enabled but the authoritative
  // quote is re-checked when the order is placed.
  useEffect(() => {
    if (!PIN_RE.test(form.pincode) || !form.date || !form.slotId) return;
    let active = true;
    const selectedSlot = slots.find((s) => s.id === form.slotId);
    const selectedWrap = wraps.find((w) => w.id === gift.wrapId);
    void requestQuote({
      ...(primaryAddress ? { addressId: primaryAddress.id } : {}),
      pincode: form.pincode,
      deliveryDate: form.date,
      ...(selectedSlot ? { slotId: selectedSlot.serverId } : {}),
      ...(selectedWrap ? { giftWrapId: selectedWrap.serverId } : {}),
      ...(cartCouponCode ? { couponCode: cartCouponCode } : {}),
    })
      .then((result) => {
        if (active) setQuote(result);
      })
      .catch(() => {
        if (active) setQuote(null);
      });
    return () => {
      active = false;
    };
  }, [
    form.pincode,
    form.date,
    form.slotId,
    gift.wrapId,
    cartCouponCode,
    slots,
    wraps,
    primaryAddress,
    requestQuote,
  ]);

  const stockProblems = useMemo(
    () =>
      cart.filter((l) => {
        if (!l.productId) return false;
        const p = products.find((x) => x.id === l.productId);
        return !p || !p.active || p.stock < l.qty;
      }),
    [cart, products],
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
    if (key === "pincode" || key === "date" || key === "slotId") setQuote(null);
  };

  if (!hydrated) return <div className="container-page h-[70vh]" />;

  if (cart.length === 0) {
    return (
      <div className="container-page py-24">
        <EmptyState
          icon={<ShoppingBag />}
          title="Nothing to check out"
          body="Your cart is empty. Add a gift or two and come back."
          action={
            <Button asChild>
              <Link to="/shop">Browse gifts</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const finish = async (orderNumber: string) => {
    const alreadySaved = profile.addresses.some(
      (a) => a.address === form.address.trim() && a.pincode === form.pincode,
    );
    if (isAuthenticated && form.saveAddress && !alreadySaved) {
      await setProfile({
        addresses: [
          {
            id: "",
            label: form.recipientName.trim(),
            name: form.recipientName.trim(),
            phone: form.recipientPhone,
            address: form.address.trim(),
            city: form.city.trim(),
            pincode: form.pincode,
          },
          ...profile.addresses,
        ],
      });
    }
    await navigate({ to: "/order/$id", params: { id: orderNumber }, replace: true });
  };

  const startProviderCheckout = async (orderNumber: string, provider: "RAZORPAY" | "CASHFREE") => {
    const session = await createPayment.mutateAsync({ orderNumber, provider });
    if (provider === "RAZORPAY") {
      const config = session as unknown as {
        keyId: string;
        orderId: string;
        amount: number;
        currency: string;
        name?: string;
        description?: string;
        prefill?: Record<string, string>;
      };
      await loadScript("https://checkout.razorpay.com/v1/checkout.js");
      const RazorpaySdk = (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay;
      if (!RazorpaySdk) throw new Error("Razorpay checkout is unavailable");
      await new Promise<void>((resolve, reject) => {
        const instance = new RazorpaySdk({
          key: config.keyId,
          amount: config.amount,
          currency: config.currency,
          name: config.name ?? "Artsheaven",
          description: config.description ?? `Order ${orderNumber}`,
          order_id: config.orderId,
          prefill: config.prefill ?? {},
          theme: { color: "#7c3aed" },
          handler: (response: RazorpayResponse) => {
            void verifyPayment
              .mutateAsync({
                provider: "RAZORPAY",
                providerOrderId: response.razorpay_order_id,
                providerPaymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              })
              .then(() => resolve())
              .catch(reject);
          },
          modal: { ondismiss: () => reject(new Error("Payment cancelled")) },
        });
        instance.open();
      });
    } else {
      const config = session as unknown as { paymentSessionId: string; environment: string };
      await loadScript("https://sdk.cashfree.com/js/v3/cashfree.js");
      const CashfreeSdk = (window as unknown as { Cashfree?: CashfreeCtor }).Cashfree;
      if (!CashfreeSdk) throw new Error("Cashfree checkout is unavailable");
      const cf = new CashfreeSdk({
        mode: config.environment === "PRODUCTION" ? "production" : "sandbox",
      });
      await cf.checkout({
        paymentSessionId: config.paymentSessionId,
        redirectTarget: "_modal",
      });
      await verifyPayment.mutateAsync({
        provider: "CASHFREE",
        providerOrderId: session.providerOrderId,
      });
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (stockProblems.length > 0) {
      toast.error("Some gifts in your cart are no longer available in that quantity.", {
        action: { label: "Review cart", onClick: () => void navigate({ to: "/cart" }) },
      });
      return;
    }
    const found = validate(
      form,
      slots.map((s) => s.id),
    );
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      document.getElementById(`f-${first}`)?.focus();
      toast.error("Please check the highlighted fields.");
      return;
    }
    setSubmitting(true);
    try {
      const selectedSlot = slots.find((s) => s.id === form.slotId);
      const selectedWrap = wraps.find((w) => w.id === gift.wrapId);
      const cardMessage = [
        gift.cardMessage.trim(),
        gift.cardFrom.trim() && `— ${gift.cardFrom.trim()}`,
      ]
        .filter(Boolean)
        .join("\n");
      const result = await placeOrder({
        ...(profile.addresses[0] ? { addressId: profile.addresses[0].id } : {}),
        pincode: form.pincode,
        deliveryDate: form.date,
        ...(selectedSlot ? { slotId: selectedSlot.serverId } : {}),
        ...(selectedWrap ? { giftWrapId: selectedWrap.serverId } : {}),
        ...(cartCouponCode ? {} : {}),
        customerEmail: form.customerEmail.trim(),
        customerPhone: form.customerPhone,
        recipientName: form.recipientName.trim(),
        recipientPhone: form.recipientPhone,
        addressLine: form.address.trim(),
        city: form.city.trim(),
        ...(cardMessage ? { cardMessage } : {}),
        paymentProvider: form.payment,
      });
      if (form.payment !== "COD") {
        await startProviderCheckout(result.orderNumber, form.payment);
      }
      toast.success("Your order is confirmed");
      await finish(result.orderNumber);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Checkout could not be completed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container-page py-8 md:py-12">
      <nav className="mb-6 text-xs text-muted-foreground">
        <Link to="/cart" className="hover:text-primary">
          Cart
        </Link>{" "}
        / <span className="text-foreground">Checkout</span>
      </nav>
      <h1 className="text-4xl text-plum md:text-5xl">Checkout</h1>

      <form
        noValidate
        onSubmit={(e) => void submit(e)}
        className="mt-8 grid gap-10 lg:grid-cols-[1fr_24rem] lg:gap-12"
      >
        <div className="min-w-0 space-y-6">
          <Section step={1} title="Your details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="customerName"
                label="Full name"
                error={errors.customerName}
                className="sm:col-span-2"
              >
                <Input
                  id="f-customerName"
                  autoComplete="name"
                  value={form.customerName}
                  onChange={(v) => set("customerName", v)}
                  invalid={!!errors.customerName}
                />
              </Field>
              <Field id="customerEmail" label="Email" error={errors.customerEmail}>
                <Input
                  id="f-customerEmail"
                  type="email"
                  autoComplete="email"
                  value={form.customerEmail}
                  onChange={(v) => set("customerEmail", v)}
                  invalid={!!errors.customerEmail}
                />
              </Field>
              <Field id="customerPhone" label="Mobile" error={errors.customerPhone}>
                <Input
                  id="f-customerPhone"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={10}
                  value={form.customerPhone}
                  onChange={(v) => set("customerPhone", v.replace(/\D/g, ""))}
                  invalid={!!errors.customerPhone}
                />
              </Field>
            </div>
          </Section>

          <Section step={2} title="Deliver to">
            {profile.addresses.length > 0 && (
              <div className="mb-5 flex flex-wrap gap-2">
                {profile.addresses.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setForm((f) => ({
                        ...f,
                        recipientName: a.name,
                        recipientPhone: a.phone,
                        address: a.address,
                        city: a.city,
                        pincode: a.pincode,
                      }));
                      setErrors((e) => ({
                        ...e,
                        recipientName: undefined,
                        recipientPhone: undefined,
                        address: undefined,
                        city: undefined,
                        pincode: undefined,
                      }));
                    }}
                    className={cn(
                      "rounded-2xl border-2 px-4 py-2 text-left text-xs transition",
                      form.address === a.address && form.pincode === a.pincode
                        ? "border-primary bg-secondary"
                        : "border-border hover:border-lilac",
                    )}
                  >
                    <p className="font-medium">{a.label}</p>
                    <p className="text-muted-foreground">
                      {a.city} · {a.pincode}
                    </p>
                  </button>
                ))}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="recipientName" label="Recipient's name" error={errors.recipientName}>
                <Input
                  id="f-recipientName"
                  value={form.recipientName}
                  onChange={(v) => set("recipientName", v)}
                  invalid={!!errors.recipientName}
                />
              </Field>
              <Field id="recipientPhone" label="Recipient's mobile" error={errors.recipientPhone}>
                <Input
                  id="f-recipientPhone"
                  inputMode="numeric"
                  maxLength={10}
                  value={form.recipientPhone}
                  onChange={(v) => set("recipientPhone", v.replace(/\D/g, ""))}
                  invalid={!!errors.recipientPhone}
                />
              </Field>
              <Field id="address" label="Address" error={errors.address} className="sm:col-span-2">
                <Input
                  id="f-address"
                  autoComplete="street-address"
                  placeholder="House no., street, landmark"
                  value={form.address}
                  onChange={(v) => set("address", v)}
                  invalid={!!errors.address}
                />
              </Field>
              <Field id="city" label="City" error={errors.city}>
                <Input
                  id="f-city"
                  autoComplete="address-level2"
                  value={form.city}
                  onChange={(v) => set("city", v)}
                  invalid={!!errors.city}
                />
              </Field>
              <Field id="pincode" label="Pincode" error={errors.pincode}>
                <Input
                  id="f-pincode"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  maxLength={6}
                  value={form.pincode}
                  onChange={(v) => set("pincode", v.replace(/\D/g, ""))}
                  invalid={!!errors.pincode}
                />
              </Field>
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={form.saveAddress}
                onChange={(e) => set("saveAddress", e.target.checked)}
                className="size-4 accent-[var(--color-primary)]"
              />
              Save this address for next time
            </label>
          </Section>

          <Section step={3} title="Delivery date & slot">
            <Field id="date" label="Date" error={errors.date} className="max-w-xs">
              <input
                id="f-date"
                type="date"
                min={earliestDate()}
                max={latestDate()}
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                className={cn(inputCls, errors.date && "border-destructive")}
              />
            </Field>
            <div
              className="mt-5 grid gap-3 sm:grid-cols-2"
              role="radiogroup"
              aria-label="Delivery slot"
            >
              {slots.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={form.slotId === s.id}
                  onClick={() => set("slotId", s.id)}
                  className={cn(
                    "flex items-center justify-between rounded-2xl border-2 px-4 py-3 text-left transition",
                    form.slotId === s.id
                      ? "border-primary bg-secondary"
                      : "border-border hover:border-lilac",
                  )}
                >
                  <span>
                    <span className="block font-medium">{s.label}</span>
                    <span className="text-xs text-muted-foreground">{s.window}</span>
                  </span>
                  <span className="text-sm font-semibold">
                    {s.fee ? `+${formatINR(s.fee)}` : "Free"}
                  </span>
                </button>
              ))}
            </div>
          </Section>

          <Section step={4} title="Payment">
            <div
              className="grid gap-3 sm:grid-cols-3"
              role="radiogroup"
              aria-label="Payment method"
            >
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={form.payment === m.id}
                  onClick={() => set("payment", m.id)}
                  className={cn(
                    "rounded-2xl border-2 p-4 text-left transition",
                    form.payment === m.id
                      ? "border-primary bg-secondary"
                      : "border-border hover:border-lilac",
                  )}
                >
                  <m.icon className="size-5 text-primary" />
                  <p className="mt-2 font-medium">{m.label}</p>
                  <p className="text-xs text-muted-foreground">{m.hint}</p>
                </button>
              ))}
            </div>
            {form.payment === "COD" ? (
              <p className="mt-5 text-sm text-muted-foreground">
                Please keep {formatINR(totals.total)} ready. Our courier accepts cash and UPI at the
                door.
              </p>
            ) : (
              <p className="mt-5 text-sm text-muted-foreground">
                You'll be taken to our secure payment partner to enter your UPI ID or card details.
                We never see or store them.
              </p>
            )}
            {quote && (
              <p className="mt-3 flex items-center gap-2 text-xs text-success">
                <Lock className="size-3.5" /> Total confirmed by the server
              </p>
            )}
          </Section>
        </div>

        <aside className="h-fit lg:sticky lg:top-28">
          <div className="rounded-3xl bg-secondary p-6">
            <div className="flex items-center justify-between">
              <p className="font-display text-xl text-plum">Your order</p>
              <Link to="/cart" className="text-sm text-primary hover:underline">
                Edit
              </Link>
            </div>
            <ul className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
              {cart.map((l) => (
                <li key={l.lineId} className="flex gap-3">
                  <div className="relative shrink-0">
                    {l.image ? (
                      <img
                        src={resolveImage(l.image)}
                        alt=""
                        className="size-14 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="grid size-14 place-items-center rounded-xl bg-card text-primary">
                        <Gift className="size-5" />
                      </div>
                    )}
                    <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-plum text-[0.65rem] font-bold text-plum-foreground">
                      {l.qty}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate font-medium">{l.name}</p>
                    {l.details && (
                      <p className="truncate text-xs text-muted-foreground">{l.details}</p>
                    )}
                  </div>
                  <span className="text-sm tabular-nums">{formatINR(l.unitPrice * l.qty)}</span>
                </li>
              ))}
            </ul>
            {(wrap || gift.cardMessage) && (
              <div className="mt-4 space-y-1 rounded-2xl bg-card p-3 text-xs text-muted-foreground">
                {wrap && <p>🎁 {wrap.name}</p>}
                {gift.cardMessage && <p className="line-clamp-2">💌 “{gift.cardMessage}”</p>}
              </div>
            )}
            <SummaryRows
              totals={totals.total === 0 ? EMPTY_TOTALS : totals}
              couponCode={cartCouponCode}
            />
            {stockProblems.length > 0 && (
              <p className="mt-4 rounded-2xl bg-destructive/10 p-3 text-xs text-destructive">
                {stockProblems.map((l) => l.name).join(", ")}{" "}
                {stockProblems.length === 1 ? "is" : "are"} no longer available in that quantity.{" "}
                <Link to="/cart" className="font-medium underline">
                  Update cart
                </Link>
              </p>
            )}
            <Button
              type="submit"
              size="lg"
              variant="hero"
              className="mt-5 w-full"
              disabled={submitting}
            >
              {submitting ? "Placing order…" : `Place order · ${formatINR(totals.total)}`}
            </Button>
          </div>
        </aside>
      </form>
    </div>
  );
}

const inputCls =
  "h-11 w-full rounded-2xl border border-input bg-card px-4 text-sm outline-none focus:border-primary";

function Input({
  id,
  value,
  onChange,
  invalid,
  ...rest
}: { id: string; value: string; onChange: (v: string) => void; invalid?: boolean } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value" | "id"
>) {
  return (
    <input
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={invalid || undefined}
      className={cn(inputCls, invalid && "border-destructive")}
      {...rest}
    />
  );
}

function Field({
  id,
  label,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string | undefined;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={`f-${id}`} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Section({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 md:p-6">
      <h2 className="mb-5 flex items-center gap-3 font-display text-xl text-plum">
        <span className="grid size-7 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {step}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}
