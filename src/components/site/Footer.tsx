import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";

export function Footer() {
  const { categories, setPrefs } = useStore();
  const [email, setEmail] = useState("");

  return (
    <footer className="mt-24 bg-plum text-plum-foreground">
      <div className="container-page grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr_1.3fr]">
        <div>
          <p className="font-display text-3xl italic">Artsheaven</p>
          <p className="mt-4 max-w-xs text-sm text-plum-foreground/70">
            Dreamy flowers, sweet chocolates and cuddly keepsakes — wrapped in lavender and
            delivered with love.
          </p>
          <p className="mt-6 text-xs text-plum-foreground/50">
            Secure checkout · Thoughtful packaging · Delivered with care
          </p>
        </div>
        <div>
          <p className="eyebrow text-lilac">Shop</p>
          <ul className="mt-4 space-y-2.5 text-sm text-plum-foreground/80">
            {categories
              .filter((c) => c.visible)
              .map((c) => (
                <li key={c.slug}>
                  <Link to="/category/$slug" params={{ slug: c.slug }} className="hover:text-lilac">
                    {c.name}
                  </Link>
                </li>
              ))}
            <li>
              <Link to="/build-a-box" className="hover:text-lilac">
                Build your own box
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="eyebrow text-lilac">Help</p>
          <ul className="mt-4 space-y-2.5 text-sm text-plum-foreground/80">
            <li>
              <Link to="/about" className="hover:text-lilac">
                Our story
              </Link>
            </li>
            <li>
              <Link to="/faq" className="hover:text-lilac">
                FAQ
              </Link>
            </li>
            <li>
              <Link to="/contact" className="hover:text-lilac">
                Contact us
              </Link>
            </li>
            <li>
              <Link to="/account" className="hover:text-lilac">
                My account
              </Link>
            </li>
            <li>
              <Link to="/admin" className="hover:text-lilac">
                Store admin
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="eyebrow text-lilac">Love letters</p>
          <p className="mt-4 text-sm text-plum-foreground/80">
            Occasion reminders and first dibs on new drops. No spam, only petals.
          </p>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!/^\S+@\S+\.\S+$/.test(email)) {
                toast.error("Please enter a valid email");
                return;
              }
              setPrefs({ newsletter: true });
              setEmail("");
              toast.success("You're on the list 💜", {
                description: "Watch your inbox for something sweet.",
              });
            }}
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              aria-label="Email address"
              className="h-11 flex-1 rounded-full border border-plum-foreground/20 bg-plum-foreground/10 px-4 text-sm text-plum-foreground placeholder:text-plum-foreground/50 outline-none focus:border-lilac"
            />
            <Button type="submit" variant="hero" className="h-11">
              Join
            </Button>
          </form>
        </div>
      </div>
      <div className="border-t border-plum-foreground/10">
        <div className="container-page flex flex-col justify-between gap-2 py-6 text-xs text-plum-foreground/50 sm:flex-row">
          <p>© 2026 Artsheaven. Made with lavender & love.</p>
          <p>Gifts from ₹99 to ₹499</p>
        </div>
      </div>
    </footer>
  );
}
