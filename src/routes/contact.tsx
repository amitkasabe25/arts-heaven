import { createFileRoute } from "@tanstack/react-router";
import { Heart, Mail, MapPin, Phone } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/site/PageHeader";
import { Button } from "@/components/ui/button";
import { usePublicSettings } from "@/lib/api-hooks";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact us — Artsheaven" },
      {
        name: "description",
        content:
          "Questions about an order or need help choosing a gift? Talk to the Artsheaven team.",
      },
    ],
  }),
  component: ContactPage,
});

function supportEmail(settings: Record<string, unknown> | undefined): string {
  const value = settings?.["public.support_email"];
  if (value && typeof value === "object") {
    const email = (value as { email?: unknown }).email;
    if (typeof email === "string" && email) return email;
  }
  return "hello@artsheaven.local";
}

function ContactPage() {
  const { data: settings } = usePublicSettings();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const to = supportEmail(settings);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const subject = encodeURIComponent(`A note from ${name.trim() || "a Artsheaven friend"}`);
    const body = encodeURIComponent(`${message.trim()}\n\n— ${name.trim()}\n${email.trim()}`);
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
    toast.success("Opening your email app");
  };

  return (
    <>
      <PageHeader
        eyebrow="Say hello"
        title={
          <>
            We'd love to <em>hear</em> from you
          </>
        }
        intro="Questions about an order, a delivery, or what to send? Drop us a note."
      />
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1fr_1fr] md:py-16">
        <div className="space-y-6">
          <div className="rounded-3xl border border-border bg-card p-6">
            <Mail className="size-6 text-primary" />
            <h2 className="mt-4 font-display text-xl text-plum">Email</h2>
            <a
              className="mt-1 inline-block text-sm text-primary hover:underline"
              href={`mailto:${to}`}
            >
              {to}
            </a>
            <p className="mt-2 text-xs text-muted-foreground">
              We usually reply within a few hours.
            </p>
          </div>
          <div className="rounded-3xl border border-border bg-card p-6">
            <Phone className="size-6 text-primary" />
            <h2 className="mt-4 font-display text-xl text-plum">WhatsApp</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Order updates are sent to the mobile number you provide at checkout.
            </p>
          </div>
          <div className="rounded-3xl border border-border bg-card p-6">
            <MapPin className="size-6 text-primary" />
            <h2 className="mt-4 font-display text-xl text-plum">Where we deliver</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Same-day across Bengaluru and pan-India shipping on eligible pincodes.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="rounded-3xl border border-border bg-card p-6 md:p-8">
          <h2 className="font-display text-2xl text-plum">Send a message</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This opens your email app with your message ready to send.
          </p>
          <div className="mt-6 space-y-4">
            <label className="block text-sm font-medium">
              Your name
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-2xl border border-input bg-background px-4 outline-none focus:border-primary"
              />
            </label>
            <label className="block text-sm font-medium">
              Your email
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-2xl border border-input bg-background px-4 outline-none focus:border-primary"
              />
            </label>
            <label className="block text-sm font-medium">
              Message
              <textarea
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="mt-1.5 w-full rounded-2xl border border-input bg-background p-4 outline-none focus:border-primary"
              />
            </label>
            <Button type="submit" variant="hero" size="lg" className="w-full">
              <Heart className="size-4" /> Open email
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
