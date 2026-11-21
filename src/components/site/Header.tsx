import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Heart, Menu, Search, ShoppingBag, User } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { OCCASIONS } from "@/lib/catalog";
import { formatINR } from "@/lib/format";
import { resolveImage } from "@/lib/images";
import { useStore, useVisibleProducts } from "@/lib/store";

const announcements = [
  "Free delivery on orders of ₹499+",
  "Same-day delivery before 2 PM",
  "A handwritten greeting card with every gift",
  "Use HEAVEN10 for 10% off",
];

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-0.5 -top-0.5 grid min-w-4.5 place-items-center rounded-full bg-primary px-1 text-[0.6rem] font-bold leading-4.5 text-primary-foreground">
      {count}
    </span>
  );
}

function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const products = useVisibleProducts();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  useEffect(() => {
    if (!open) setQ("");
  }, [open]);
  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return products.slice().sort((a, b) => b.popularity - a.popularity).slice(0, 4);
    return products.filter((p) => p.name.toLowerCase().includes(term) || p.description.toLowerCase().includes(term)).slice(0, 6);
  }, [q, products]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-3xl p-0">
        <DialogTitle className="sr-only">Search gifts</DialogTitle>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onOpenChange(false);
            void navigate({ to: "/shop", search: { q: q.trim() || undefined } });
          }}
          className="flex items-center gap-3 border-b border-border px-5 py-4"
        >
          <Search className="size-5 text-primary" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search roses, teddies, hampers…"
            className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
        </form>
        <div className="max-h-[60vh] overflow-y-auto p-3">
          <p className="px-2 pb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {q ? `${results.length} matches` : "Loved right now"}
          </p>
          {results.map((p) => (
            <Link
              key={p.id}
              to="/product/$slug"
              params={{ slug: p.slug }}
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-secondary"
            >
              <img src={resolveImage(p.images[0] ?? "")} alt="" className="size-14 rounded-xl object-cover" />
              <div className="flex-1">
                <p className="font-display text-plum">{p.name}</p>
                <p className="text-sm text-muted-foreground">{formatINR(p.price)}</p>
              </div>
            </Link>
          ))}
          {q && results.length === 0 && <p className="px-2 py-6 text-center text-sm text-muted-foreground">No gifts match “{q}” yet.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Header() {
  const { cartCount, wishlist, categories } = useStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const visibleCategories = categories.filter((c) => c.visible);

  const navLink = "text-sm font-medium text-foreground/80 transition hover:text-primary";

  return (
    <header className="sticky top-0 z-40">
      <div className="overflow-hidden bg-plum py-2 text-plum-foreground">
        <div className="flex w-max animate-marquee gap-12 whitespace-nowrap text-xs tracking-wide">
          {[...announcements, ...announcements].map((a, i) => (
            <span key={i} className="flex items-center gap-12">
              {a}
              <span aria-hidden>✿</span>
            </span>
          ))}
        </div>
      </div>
      <div className="border-b border-border bg-background/85 backdrop-blur-lg">
        <div className="container-page flex h-16 items-center gap-6 md:h-20">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button className="grid size-10 place-items-center rounded-full hover:bg-secondary lg:hidden" aria-label="Open menu">
                <Menu className="size-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 overflow-y-auto bg-background">
              <SheetTitle className="font-display text-2xl italic text-plum">Artsheaven</SheetTitle>
              <nav className="mt-8 flex flex-col gap-1" onClick={() => setMenuOpen(false)}>
                <Link to="/" className="rounded-xl px-3 py-2.5 hover:bg-secondary">Home</Link>
                <Link to="/shop" className="rounded-xl px-3 py-2.5 hover:bg-secondary">Shop all</Link>
                <p className="mt-4 px-3 text-xs font-semibold uppercase tracking-widest text-primary">Categories</p>
                {visibleCategories.map((c) => (
                  <Link key={c.slug} to="/category/$slug" params={{ slug: c.slug }} className="rounded-xl px-3 py-2 text-sm hover:bg-secondary">
                    {c.name}
                  </Link>
                ))}
                <p className="mt-4 px-3 text-xs font-semibold uppercase tracking-widest text-primary">More</p>
                <Link to="/build-a-box" className="rounded-xl px-3 py-2.5 hover:bg-secondary">Build your own gift box</Link>
                <Link to="/wishlist" className="rounded-xl px-3 py-2.5 hover:bg-secondary">Wishlist</Link>
                <Link to="/account" className="rounded-xl px-3 py-2.5 hover:bg-secondary">My account</Link>
                <Link to="/about" className="rounded-xl px-3 py-2.5 hover:bg-secondary">About us</Link>
                <Link to="/faq" className="rounded-xl px-3 py-2.5 hover:bg-secondary">FAQ</Link>
                <Link to="/contact" className="rounded-xl px-3 py-2.5 hover:bg-secondary">Contact</Link>
              </nav>
            </SheetContent>
          </Sheet>

          <Link to="/" className="font-display text-2xl italic tracking-tight text-plum md:text-3xl">
            Arts<span className="text-primary">heaven</span>
          </Link>

          <nav className="ml-6 hidden items-center gap-7 lg:flex">
            <Link to="/shop" className={navLink} activeProps={{ className: "text-primary" }}>
              Shop all
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger className={`${navLink} flex items-center gap-1 outline-none`}>
                Categories <ChevronDown className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64 rounded-2xl p-2">
                {visibleCategories.map((c) => (
                  <DropdownMenuItem key={c.slug} asChild className="rounded-xl px-3 py-2">
                    <Link to="/category/$slug" params={{ slug: c.slug }}>
                      {c.name}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger className={`${navLink} flex items-center gap-1 outline-none`}>
                Occasions <ChevronDown className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 rounded-2xl p-2">
                {OCCASIONS.map((o) => (
                  <DropdownMenuItem key={o.id} asChild className="rounded-xl px-3 py-2">
                    <Link to="/shop" search={{ occasion: o.id }}>
                      <span className="mr-1">{o.emoji}</span> {o.name}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Link to="/build-a-box" className={navLink} activeProps={{ className: "text-primary" }}>
              Build a box
            </Link>
            <Link to="/about" className={navLink} activeProps={{ className: "text-primary" }}>
              Our story
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => setSearchOpen(true)} className="grid size-10 place-items-center rounded-full hover:bg-secondary" aria-label="Search">
              <Search className="size-5" />
            </button>
            <Link to="/account" className="hidden size-10 place-items-center rounded-full hover:bg-secondary sm:grid" aria-label="My account">
              <User className="size-5" />
            </Link>
            <Link to="/wishlist" className="relative grid size-10 place-items-center rounded-full hover:bg-secondary" aria-label="Wishlist">
              <Heart className="size-5" />
              <CountBadge count={wishlist.length} />
            </Link>
            <Link to="/cart" className="relative grid size-10 place-items-center rounded-full hover:bg-secondary" aria-label="Cart">
              <ShoppingBag className="size-5" />
              <CountBadge count={cartCount} />
            </Link>
          </div>
        </div>
      </div>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
