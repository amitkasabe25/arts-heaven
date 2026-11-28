import { createFileRoute, Link } from "@tanstack/react-router";
import { LogOut, Package, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/site/PageHeader";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "My account — Artsheaven" },
      { name: "description", content: "Your Artsheaven profile, addresses and orders." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { isAuthenticated, user, profile, orders, login, register, logout, setProfile } =
    useStore();

  if (!isAuthenticated) {
    return <AuthForms onLogin={login} onRegister={register} />;
  }

  return (
    <>
      <PageHeader
        eyebrow="Your space"
        title={
          <>
            Hello, <em>{profile.name.split(" ")[0]}</em>
          </>
        }
        intro="Your details, saved addresses and recent gifts — all in one place."
      />
      <div className="container-page grid gap-6 py-10 md:grid-cols-[1fr_20rem] md:py-14">
        <div className="space-y-6">
          <section className="rounded-3xl border border-border bg-card p-6">
            <h2 className="flex items-center gap-2 font-display text-xl text-plum">
              <UserRound className="size-5 text-primary" /> Profile
            </h2>
            <form
              className="mt-5 grid gap-4 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void setProfile({
                  name: String(form.get("name") ?? ""),
                  phone: String(form.get("phone") ?? ""),
                  birthday: String(form.get("birthday") ?? ""),
                });
              }}
            >
              <label className="text-sm font-medium">
                Name
                <input
                  name="name"
                  defaultValue={profile.name}
                  className="mt-1.5 h-11 w-full rounded-2xl border border-input bg-background px-4 outline-none focus:border-primary"
                />
              </label>
              <label className="text-sm font-medium">
                Email
                <input
                  value={user?.email ?? profile.email}
                  readOnly
                  className="mt-1.5 h-11 w-full rounded-2xl border border-input bg-secondary px-4 text-muted-foreground"
                />
              </label>
              <label className="text-sm font-medium">
                Phone
                <input
                  name="phone"
                  defaultValue={profile.phone}
                  className="mt-1.5 h-11 w-full rounded-2xl border border-input bg-background px-4 outline-none focus:border-primary"
                />
              </label>
              <label className="text-sm font-medium">
                Birthday
                <input
                  name="birthday"
                  type="date"
                  defaultValue={profile.birthday}
                  className="mt-1.5 h-11 w-full rounded-2xl border border-input bg-background px-4 outline-none focus:border-primary"
                />
              </label>
              <Button type="submit" variant="hero" className="w-fit">
                Save changes
              </Button>
            </form>
          </section>

          <section className="rounded-3xl border border-border bg-card p-6">
            <h2 className="flex items-center gap-2 font-display text-xl text-plum">
              <Package className="size-5 text-primary" /> Recent orders
            </h2>
            {orders.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                No orders yet.{" "}
                <Link to="/shop" className="text-primary hover:underline">
                  Find something lovely
                </Link>
                .
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-border">
                {orders.slice(0, 8).map((order) => (
                  <li
                    key={order.id}
                    className="flex items-center justify-between gap-3 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <Link
                        to="/order/$id"
                        params={{ id: order.id }}
                        className="font-medium hover:text-primary"
                      >
                        {order.id}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {order.lines.length} item{order.lines.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span className="shrink-0 capitalize text-muted-foreground">
                      {order.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="h-fit space-y-4">
          <div className="rounded-3xl bg-secondary p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              Saved addresses
            </p>
            {profile.addresses.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No saved addresses yet. Add one at checkout to speed things up next time.
              </p>
            ) : (
              <ul className="mt-3 space-y-3 text-sm">
                {profile.addresses.map((address) => (
                  <li key={address.id} className="rounded-2xl bg-card p-3">
                    <p className="font-medium">{address.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {address.address}, {address.city} {address.pincode}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => void logout().then(() => toast.success("Signed out"))}
          >
            <LogOut className="size-4" /> Sign out
          </Button>
        </aside>
      </div>
    </>
  );
}

function AuthForms({
  onLogin,
  onRegister,
}: {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }) => Promise<void>;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    setBusy(true);
    try {
      if (mode === "login") {
        await onLogin(email, password);
        toast.success("Welcome back");
      } else {
        await onRegister({
          name: String(form.get("name") ?? ""),
          email,
          password,
          ...(String(form.get("phone") ?? "") ? { phone: String(form.get("phone")) } : {}),
        });
        toast.success("Account created — please sign in");
        setMode("login");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Welcome"
        title={
          <>
            Your <em>account</em>
          </>
        }
        intro="Sign in to see your orders, save addresses and check out faster."
      />
      <div className="container-page py-12">
        <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-6 md:p-8">
          <div className="mb-6 grid grid-cols-2 gap-2 rounded-full bg-secondary p-1">
            {(["login", "register"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setMode(item)}
                className={cn(
                  "rounded-full py-2 text-sm font-medium capitalize transition",
                  mode === item ? "bg-card text-plum shadow-soft" : "text-muted-foreground",
                )}
              >
                {item}
              </button>
            ))}
          </div>
          <form onSubmit={(e) => void submit(e)} className="space-y-4">
            {mode === "register" && (
              <label className="block text-sm font-medium">
                Name
                <input
                  name="name"
                  required
                  className="mt-1.5 h-11 w-full rounded-2xl border border-input bg-background px-4 outline-none focus:border-primary"
                />
              </label>
            )}
            <label className="block text-sm font-medium">
              Email
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className="mt-1.5 h-11 w-full rounded-2xl border border-input bg-background px-4 outline-none focus:border-primary"
              />
            </label>
            {mode === "register" && (
              <label className="block text-sm font-medium">
                Phone <span className="font-normal text-muted-foreground">(optional)</span>
                <input
                  name="phone"
                  inputMode="numeric"
                  className="mt-1.5 h-11 w-full rounded-2xl border border-input bg-background px-4 outline-none focus:border-primary"
                />
              </label>
            )}
            <label className="block text-sm font-medium">
              Password
              <input
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="mt-1.5 h-11 w-full rounded-2xl border border-input bg-background px-4 outline-none focus:border-primary"
              />
            </label>
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
