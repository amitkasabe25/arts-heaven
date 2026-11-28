import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Boxes,
  ClipboardList,
  Gift,
  LayoutDashboard,
  LogOut,
  Package,
  Percent,
  Settings2,
  Star,
  Truck,
  Users,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import { formatINR } from "@/lib/format";
import { broadcastDataInvalidation } from "@/lib/query-invalidation";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin — Artsheaven" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminPage,
});

type SectionId =
  | "dashboard"
  | "catalogue"
  | "orders"
  | "inventory"
  | "coupons"
  | "shipping"
  | "reviews"
  | "banners"
  | "settings"
  | "users";

const SECTIONS: Array<{ id: SectionId; label: string; icon: typeof LayoutDashboard }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "catalogue", label: "Catalogue", icon: Package },
  { id: "orders", label: "Orders", icon: ClipboardList },
  { id: "inventory", label: "Inventory", icon: Boxes },
  { id: "coupons", label: "Coupons", icon: Percent },
  { id: "shipping", label: "Shipping", icon: Truck },
  { id: "reviews", label: "Reviews", icon: Star },
  { id: "banners", label: "Banners", icon: Gift },
  { id: "settings", label: "Settings", icon: Settings2 },
  { id: "users", label: "Users", icon: Users },
];

const STAFF_ROLES = new Set(["SUPER_ADMIN", "STORE_MANAGER", "ORDER_MANAGER", "INVENTORY_MANAGER"]);

function AdminPage() {
  const { isAuthenticated, user, login, logout } = useStore();
  const [section, setSection] = useState<SectionId>("dashboard");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const isStaff = !!user?.roles?.some((role) => STAFF_ROLES.has(role));

  if (!isAuthenticated || !isStaff) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dream px-4">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-soft">
          <h1 className="font-display text-3xl text-plum">Staff sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This area is restricted to Artsheaven staff accounts.
          </p>
          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setBusy(true);
              void login(email, password, true)
                .then(() => toast.success("Signed in"))
                .catch((error: unknown) =>
                  toast.error(error instanceof Error ? error.message : "Sign in failed"),
                )
                .finally(() => setBusy(false));
            }}
          >
            <label className="block text-sm font-medium">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1.5 h-11 w-full rounded-2xl border border-input bg-background px-4 outline-none focus:border-primary"
              />
            </label>
            <label className="block text-sm font-medium">
              Password
              <input
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1.5 h-11 w-full rounded-2xl border border-input bg-background px-4 outline-none focus:border-primary"
              />
            </label>
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <Link to="/" className="mt-5 block text-center text-sm text-primary hover:underline">
            Back to the store
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dream">
      <div className="mx-auto flex max-w-[1400px] gap-6 px-4 py-6 lg:px-8">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-6 rounded-3xl border border-border bg-card p-4">
            <Link to="/" className="block px-3 font-display text-xl italic text-plum">
              Arts<span className="text-primary">heaven</span>
            </Link>
            <p className="mb-5 px-3 text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
              Admin console
            </p>
            <nav className="space-y-1">
              {SECTIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSection(id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition",
                    section === id
                      ? "bg-secondary font-medium text-primary"
                      : "hover:bg-secondary/60",
                  )}
                >
                  <Icon className="size-4" /> {label}
                </button>
              ))}
            </nav>
            <Button
              variant="ghost"
              className="mt-5 w-full justify-start"
              onClick={() => void logout()}
            >
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl text-plum">
                {SECTIONS.find((item) => item.id === section)?.label}
              </h1>
              <p className="text-sm text-muted-foreground">Signed in as {user?.email ?? "staff"}</p>
            </div>
            <select
              value={section}
              onChange={(event) => setSection(event.target.value as SectionId)}
              className="h-10 rounded-2xl border border-input bg-card px-3 text-sm lg:hidden"
            >
              {SECTIONS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {section === "dashboard" && <DashboardSection />}
          {section === "catalogue" && <CatalogueSection />}
          {section === "orders" && <OrdersSection />}
          {section === "inventory" && <InventorySection />}
          {section === "coupons" && <CouponsSection />}
          {section === "shipping" && <ShippingSection />}
          {section === "reviews" && <ReviewsSection />}
          {section === "banners" && <BannersSection />}
          {section === "settings" && <SettingsSection />}
          {section === "users" && <UsersSection />}
        </main>
      </div>
    </div>
  );
}

/* --------------------------- shared helpers --------------------------- */

/** Loose row shape for admin API responses. Explicit fields keep dot access
 * valid under `noPropertyAccessFromIndexSignature` while the index signature
 * tolerates the many optional fields returned by different endpoints. */
interface Row {
  [key: string]: unknown;
  id?: string;
  name?: string;
  sku?: string | null;
  slug?: string;
  category?: { slug?: string } | string | null;
  sellingPrice?: string | number;
  stockQty?: number;
  status?: string;
  orderNumber?: string;
  guestEmail?: string | null;
  total?: string | number;
  paymentProvider?: string;
  createdAt?: string;
  product?: { name?: string; sku?: string | null } | null;
  quantity?: number;
  code?: string;
  type?: string;
  value?: string | number;
  usedCount?: number;
  isActive?: boolean;
  pincodePrefixes?: string[];
  deliveryFee?: string | number;
  freeAbove?: string | number | null;
  estimatedDaysMin?: number;
  estimatedDaysMax?: number;
  rating?: number;
  title?: string | null;
  user?: { name?: string } | null;
  link?: string | null;
  position?: number;
  key?: string;
  email?: string;
  roles?: string[];
  description?: string | null;
  revenue?: number;
  totalOrders?: number;
  pendingOrders?: number;
  totalCustomers?: number;
  recentOrders?: Row[];
  lowStock?: Row[];
  items?: Row[];
  subtitle?: string | null;
  imageUrl?: string;
  label?: string;
  windowText?: string;
  fee?: string | number;
  price?: string | number;
}

/** Every JsonForm field is always present as a string (empty when untouched). */
interface FormValues {
  [key: string]: string;
  code: string;
  sku: string;
  type: string;
  value: string;
  minSubtotal: string;
  usageLimit: string;
  name: string;
  pincodePrefixes: string;
  deliveryFee: string;
  freeAbove: string;
  label: string;
  windowText: string;
  fee: string;
  description: string;
  price: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  link: string;
  position: string;
  key: string;
  slug: string;
  categoryId: string;
  basePrice: string;
  sellingPrice: string;
  compareAtPrice: string;
  stockQty: string;
  shortDescription: string;
  thumbnail: string;
  bannerImage: string;
  status: string;
  displayOrder: string;
  isVisible: string;
  email: string;
  password: string;
  roles: string;
  isActive: string;
}

const str = (value: unknown, fallback = "—") =>
  typeof value === "string" && value ? value : value == null ? fallback : String(value);
const num = (value: unknown) => Number(value) || 0;
const parseJsonObject = (value: string): Record<string, unknown> => {
  const parsed = JSON.parse(value) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Value must be a JSON object");
  }
  return parsed as Record<string, unknown>;
};
const categoryName = (category: Row["category"]): string =>
  typeof category === "string" ? category : (category?.slug ?? "—");

function useAdminList<T>(name: string, path: string) {
  return useQuery({
    queryKey: ["admin", name, path],
    queryFn: () => apiClient.get<T>(path),
  });
}

/** For endpoints returning `{ data: T[], meta }`; the envelope unwraps `data`. */
function useAdminPagedList<T>(name: string, path: string) {
  return useQuery({
    queryKey: ["admin", name, path],
    queryFn: () => apiClient.getPaged<T[]>(path),
  });
}

function useInvalidateAdmin() {
  const client = useQueryClient();
  // Admin writes can affect public queries too (catalogue, settings, banners).
  // Invalidate this tab now, then tell other open tabs to do the same.
  return () => {
    void client.invalidateQueries();
    broadcastDataInvalidation();
  };
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 md:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl text-plum">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Nothing here yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            {headers.map((header) => (
              <th key={header} className="border-b border-border pb-2 pr-4">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, index) => (
            <tr key={index} className="align-middle">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="py-3 pr-4">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl text-plum">{value}</p>
    </div>
  );
}

interface JsonFormField {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  textarea?: boolean;
  options?: Array<{ label: string; value: string }>;
  /** Renders a local file picker that uploads first and submits the returned URL. */
  imageOwnerType?: "PRODUCT" | "CATEGORY";
}

function ImageUploadField({
  name,
  label,
  ownerType,
}: {
  name: string;
  label: string;
  ownerType: "PRODUCT" | "CATEGORY";
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <label className="text-sm font-medium sm:col-span-2">
      {label}
      <input type="hidden" name={name} value={url} />
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={busy}
        onChange={async (event) => {
          const file = event.currentTarget.files?.[0];
          if (!file) return;
          if (file.size > 5 * 1024 * 1024) {
            setError("Image must be 5 MB or smaller");
            return;
          }
          const form = new FormData();
          form.append("file", file);
          form.append("ownerType", ownerType);
          setBusy(true);
          setError("");
          try {
            const asset = await apiClient.upload<{ url: string | null }>("/uploads/local", form);
            if (!asset.url) throw new Error("Upload did not return a public URL");
            setUrl(asset.url);
            toast.success("Image uploaded");
          } catch (uploadError) {
            setError(uploadError instanceof Error ? uploadError.message : "Upload failed");
          } finally {
            setBusy(false);
          }
        }}
        className="mt-1.5 block w-full cursor-pointer rounded-xl border border-input bg-background p-2 text-xs outline-none focus:border-primary"
      />
      {busy && <p className="mt-1 text-xs text-muted-foreground">Uploading…</p>}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      {url && (
        <img
          src={url}
          alt="Uploaded preview"
          className="mt-3 h-24 w-24 rounded-xl border border-border object-cover"
        />
      )}
    </label>
  );
}

function JsonForm({
  fields,
  submitLabel,
  onSubmit,
}: {
  fields: JsonFormField[];
  submitLabel: string;
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [formKey, setFormKey] = useState(0);
  return (
    <form
      key={formKey}
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const values = {} as FormValues;
        for (const field of fields) values[field.name] = String(data.get(field.name) ?? "");
        setBusy(true);
        void onSubmit(values)
          .then(() => {
            toast.success("Saved");
            // Remount so controlled upload fields clear their previews too.
            setFormKey((key) => key + 1);
          })
          .catch((error: unknown) =>
            toast.error(error instanceof Error ? error.message : "Could not save"),
          )
          .finally(() => setBusy(false));
      }}
    >
      {fields.map((field) =>
        field.imageOwnerType ? (
          <ImageUploadField
            key={field.name}
            name={field.name}
            label={field.label}
            ownerType={field.imageOwnerType}
          />
        ) : (
          <label
            key={field.name}
            className={cn("text-sm font-medium", field.textarea && "sm:col-span-2")}
          >
            {field.label}
            {field.options ? (
              <select
                name={field.name}
                required={field.required}
                defaultValue={field.defaultValue ?? ""}
                className="mt-1.5 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary"
              >
                <option value="" disabled>
                  Select…
                </option>
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : field.textarea ? (
              <textarea
                name={field.name}
                required={field.required}
                placeholder={field.placeholder}
                defaultValue={field.defaultValue}
                rows={3}
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            ) : (
              <input
                name={field.name}
                type={field.type ?? "text"}
                required={field.required}
                placeholder={field.placeholder}
                defaultValue={field.defaultValue}
                className="mt-1.5 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary"
              />
            )}
          </label>
        ),
      )}
      <div className="sm:col-span-2">
        <Button type="submit" variant="hero" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

/* ----------------------------- sections ------------------------------ */

function DashboardSection() {
  const { data, isLoading } = useAdminList<Row>("/admin/dashboard", "/admin/dashboard");
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data) return null;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Paid revenue" value={formatINR(num(data.revenue))} />
        <Stat label="Paid orders" value={num(data.totalOrders)} />
        <Stat label="Awaiting payment" value={num(data.pendingOrders)} />
        <Stat label="Customers" value={num(data.totalCustomers)} />
      </div>
      <Panel title="Recent orders">
        <Table
          headers={["Order", "Customer", "Total", "Status", "Placed"]}
          rows={(Array.isArray(data.recentOrders) ? data.recentOrders : []).map((order: Row) => [
            <Link
              key="link"
              to="/order/$id"
              params={{ id: str(order.orderNumber) }}
              className="text-primary hover:underline"
            >
              {str(order.orderNumber)}
            </Link>,
            str(order.guestEmail),
            formatINR(num(order.total)),
            str(order.status),
            str(order.createdAt).slice(0, 10),
          ])}
        />
      </Panel>
      <Panel title="Low stock">
        <Table
          headers={["Product", "SKU", "Quantity"]}
          rows={(Array.isArray(data.lowStock) ? data.lowStock : []).map((item: Row) => [
            str(item.name),
            str(item.sku),
            num(item.quantity),
          ])}
        />
      </Panel>
    </div>
  );
}

function CatalogueSection() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminPagedList<Row>(
    `products-${page}`,
    `/admin/products?page=${page}&limit=20`,
  );
  const categories = useAdminPagedList<Row>("categories", "/admin/categories?limit=100");
  const invalidate = useInvalidateAdmin();

  const createCategory = useMutation({
    mutationFn: (values: FormValues) =>
      apiClient.post("/categories", {
        name: values.name.trim(),
        ...(values.slug ? { slug: values.slug.trim() } : {}),
        ...(values.description ? { description: values.description } : {}),
        ...(values.thumbnail ? { thumbnail: values.thumbnail } : {}),
        ...(values.bannerImage ? { bannerImage: values.bannerImage } : {}),
        ...(values.displayOrder ? { displayOrder: Number(values.displayOrder) } : {}),
        isVisible: values.isVisible !== "false",
      }),
    onSuccess: invalidate,
  });

  const createProduct = useMutation({
    mutationFn: (values: FormValues) =>
      apiClient.post("/products", {
        name: values.name.trim(),
        categoryId: values.categoryId,
        basePrice: Number(values.basePrice),
        sellingPrice: Number(values.sellingPrice),
        ...(values.sku ? { sku: values.sku.trim() } : {}),
        ...(values.shortDescription ? { shortDescription: values.shortDescription } : {}),
        ...(values.description ? { description: values.description } : {}),
        ...(values.compareAtPrice ? { compareAtPrice: Number(values.compareAtPrice) } : {}),
        ...(values.stockQty ? { stockQty: Number(values.stockQty) } : {}),
        ...(values.status ? { status: values.status } : {}),
        ...(values.imageUrl
          ? { images: [{ url: values.imageUrl, alt: values.name, isPrimary: true, position: 0 }] }
          : {}),
      }),
    onSuccess: invalidate,
  });

  const toggleStatus = useMutation({
    mutationFn: ({ slug, status }: { slug: string; status: string }) =>
      apiClient.patch(`/products/${encodeURIComponent(slug)}`, { status }),
    onSuccess: invalidate,
  });

  const categoryOptions = (categories.data?.items ?? []).map((category) => ({
    label: `${str(category.name)} (${str(category.slug)})`,
    value: str(category.id),
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Add category">
          <JsonForm
            submitLabel="Add category"
            fields={[
              { name: "name", label: "Name", required: true, placeholder: "Fresh flowers" },
              { name: "slug", label: "Slug (optional)", placeholder: "fresh-flowers" },
              { name: "description", label: "Description", textarea: true },
              {
                name: "thumbnail",
                label: "Thumbnail image (optional)",
                imageOwnerType: "CATEGORY",
              },
              {
                name: "bannerImage",
                label: "Banner image (optional)",
                imageOwnerType: "CATEGORY",
              },
              { name: "displayOrder", label: "Display order", type: "number" },
              {
                name: "isVisible",
                label: "Visible on storefront",
                defaultValue: "true",
                options: [
                  { label: "Yes", value: "true" },
                  { label: "No", value: "false" },
                ],
              },
            ]}
            onSubmit={async (values) => {
              await createCategory.mutateAsync(values);
            }}
          />
        </Panel>
        <Panel title="Add product">
          {categoryOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Create a category first, then add products to it.
            </p>
          ) : (
            <JsonForm
              submitLabel="Add product"
              fields={[
                { name: "name", label: "Name", required: true, placeholder: "Rose bouquet" },
                { name: "sku", label: "SKU", placeholder: "ROS-001" },
                {
                  name: "categoryId",
                  label: "Category",
                  required: true,
                  options: categoryOptions,
                },
                { name: "basePrice", label: "Base price", type: "number", required: true },
                { name: "sellingPrice", label: "Selling price", type: "number", required: true },
                { name: "compareAtPrice", label: "Compare-at price", type: "number" },
                { name: "stockQty", label: "Stock quantity", type: "number" },
                {
                  name: "status",
                  label: "Status",
                  required: true,
                  defaultValue: "ACTIVE",
                  options: [
                    { label: "Active", value: "ACTIVE" },
                    { label: "Draft", value: "DRAFT" },
                  ],
                },
                { name: "shortDescription", label: "Short description", textarea: true },
                { name: "description", label: "Description", textarea: true },
                {
                  name: "imageUrl",
                  label: "Product image (optional)",
                  imageOwnerType: "PRODUCT",
                },
              ]}
              onSubmit={async (values) => {
                await createProduct.mutateAsync(values);
              }}
            />
          )}
        </Panel>
      </div>

      <Panel title="Products">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <Table
              headers={["Name", "SKU", "Category", "Price", "Stock", "Status", ""]}
              rows={(data?.items ?? []).map((product) => [
                str(product.name),
                str(product.sku),
                categoryName(product.category),
                formatINR(num(product.sellingPrice)),
                num(product.stockQty),
                str(product.status),
                <Button
                  key={product.id as string}
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const next = product.status === "ACTIVE" ? "DRAFT" : "ACTIVE";
                    void toggleStatus
                      .mutateAsync({ slug: str(product.slug), status: next })
                      .then(() => toast.success(`Product ${next.toLowerCase()}`))
                      .catch((error: unknown) =>
                        toast.error(error instanceof Error ? error.message : "Update failed"),
                      );
                  }}
                >
                  {product.status === "ACTIVE" ? "Unpublish" : "Publish"}
                </Button>,
              ])}
            />
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>{data?.meta?.total ?? 0} products</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span>
                  Page {page} / {data?.meta?.totalPages ?? 1}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= (data?.meta?.totalPages ?? 1)}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}

function OrdersSection() {
  const { data, isLoading } = useAdminPagedList<Row>("orders", "/admin/orders?limit=50");
  const invalidate = useInvalidateAdmin();
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiClient.patch(`/admin/orders/${encodeURIComponent(id)}/status`, { status }),
    onSuccess: invalidate,
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <Panel title="All orders">
      <Table
        headers={["Order", "Customer", "Total", "Payment", "Status", "Update"]}
        rows={(data?.items ?? []).map((order) => [
          <Link
            key="link"
            to="/order/$id"
            params={{ id: str(order.orderNumber) }}
            className="text-primary hover:underline"
          >
            {str(order.orderNumber)}
          </Link>,
          str(order.guestEmail),
          formatINR(num(order.total)),
          str(order.paymentProvider),
          str(order.status),
          <select
            key={`status-${order.id as string}`}
            defaultValue={str(order.status)}
            onChange={(event) => {
              void updateStatus
                .mutateAsync({ id: str(order.id), status: event.target.value })
                .then(() => toast.success("Status updated"))
                .catch((error: unknown) =>
                  toast.error(error instanceof Error ? error.message : "Update failed"),
                );
            }}
            className="h-9 rounded-xl border border-input bg-background px-2 text-xs"
          >
            {[
              "PENDING",
              "PAYMENT_PENDING",
              "CONFIRMED",
              "PROCESSING",
              "READY_TO_SHIP",
              "SHIPPED",
              "OUT_FOR_DELIVERY",
              "DELIVERED",
              "CANCELLED",
            ].map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>,
        ])}
      />
    </Panel>
  );
}

function InventorySection() {
  const { data, isLoading } = useAdminPagedList<Row>("inventory", "/admin/inventory?limit=50");
  const invalidate = useInvalidateAdmin();
  const adjust = useMutation({
    mutationFn: ({ id, delta, reason }: { id: string; delta: number; reason: string }) =>
      apiClient.post(`/admin/inventory/${encodeURIComponent(id)}/adjust`, { delta, reason }),
    onSuccess: invalidate,
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <Panel title="Stock levels">
      <Table
        headers={["Product", "SKU", "Quantity", "Adjust"]}
        rows={(data?.items ?? []).map((item) => [
          str(item.product?.name ?? item.name),
          str(item.product?.sku ?? item.sku),
          num(item.quantity),
          <form
            key={item.id as string}
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void adjust
                .mutateAsync({
                  id: str(item.id),
                  delta: Number(data.get("delta")) || 0,
                  reason: String(data.get("reason") || "Manual adjustment"),
                })
                .then(() => toast.success("Stock adjusted"))
                .catch((error: unknown) =>
                  toast.error(error instanceof Error ? error.message : "Adjustment failed"),
                );
            }}
          >
            <input
              name="delta"
              type="number"
              required
              placeholder="± qty"
              className="h-9 w-20 rounded-xl border border-input bg-background px-2 text-xs"
            />
            <input
              name="reason"
              placeholder="Reason"
              className="h-9 w-28 rounded-xl border border-input bg-background px-2 text-xs"
            />
            <Button size="sm" variant="outline" type="submit">
              Apply
            </Button>
          </form>,
        ])}
      />
    </Panel>
  );
}

function CouponsSection() {
  const { data, isLoading } = useAdminList<Row[]>("coupons", "/coupons?limit=50");
  const invalidate = useInvalidateAdmin();
  const create = useMutation({
    mutationFn: (values: FormValues) =>
      apiClient.post("/coupons", {
        code: values.code.toUpperCase(),
        type: values.type,
        value: Number(values.value),
        ...(values.minSubtotal ? { minSubtotal: Number(values.minSubtotal) } : {}),
        ...(values.usageLimit ? { usageLimit: Number(values.usageLimit) } : {}),
      }),
    onSuccess: invalidate,
  });
  const toggle = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/coupons/${encodeURIComponent(id)}`, {}),
    onSuccess: invalidate,
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <div className="space-y-6">
      <Panel title="Create coupon">
        <JsonForm
          submitLabel="Create coupon"
          fields={[
            { name: "code", label: "Code", required: true, placeholder: "e.g. SPRING10" },
            { name: "type", label: "Type (PERCENT/FIXED)", required: true, placeholder: "PERCENT" },
            { name: "value", label: "Value", type: "number", required: true },
            { name: "minSubtotal", label: "Minimum subtotal", type: "number" },
            { name: "usageLimit", label: "Usage limit", type: "number" },
          ]}
          onSubmit={async (values) => {
            await create.mutateAsync(values);
          }}
        />
      </Panel>
      <Panel title="Coupons">
        <Table
          headers={["Code", "Type", "Value", "Used", "Active", ""]}
          rows={(data ?? []).map((coupon) => [
            str(coupon.code),
            str(coupon.type),
            num(coupon.value),
            num(coupon.usedCount),
            coupon.isActive ? "Yes" : "No",
            <Button
              key={coupon.id as string}
              size="sm"
              variant="outline"
              onClick={() =>
                void toggle.mutateAsync(str(coupon.id)).then(() => toast.success("Coupon updated"))
              }
            >
              {coupon.isActive ? "Disable" : "Enable"}
            </Button>,
          ])}
        />
      </Panel>
    </div>
  );
}

function ShippingSection() {
  const zones = useAdminList<Row[]>("shipping-zones", "/admin/shipping/zones");
  const slots = useAdminList<Row[]>("shipping-slots", "/checkout/slots");
  const wraps = useAdminList<Row[]>("shipping-wraps", "/checkout/wraps");
  const invalidate = useInvalidateAdmin();
  return (
    <div className="space-y-6">
      <Panel title="Delivery zones">
        <Table
          headers={["Name", "Prefixes", "Fee", "Free above", "Days", ""]}
          rows={(zones.data ?? []).map((zone) => [
            str(zone.name),
            Array.isArray(zone.pincodePrefixes) ? zone.pincodePrefixes.join(", ") : "—",
            formatINR(num(zone.deliveryFee)),
            zone.freeAbove ? formatINR(num(zone.freeAbove)) : "—",
            `${num(zone.estimatedDaysMin)}–${num(zone.estimatedDaysMax)}`,
            <Button
              key={zone.id as string}
              size="sm"
              variant="outline"
              onClick={() => {
                void apiClient
                  .delete(`/admin/shipping/zones/${encodeURIComponent(str(zone.id))}`)
                  .then(() => {
                    invalidate();
                    toast.success("Zone deleted");
                  });
              }}
            >
              Delete
            </Button>,
          ])}
        />
        <div className="mt-5 border-t border-border pt-5">
          <JsonForm
            submitLabel="Add zone"
            fields={[
              { name: "name", label: "Name", required: true },
              {
                name: "pincodePrefixes",
                label: "Pincode prefixes (comma separated)",
                required: true,
              },
              { name: "deliveryFee", label: "Delivery fee", type: "number", required: true },
              { name: "freeAbove", label: "Free above", type: "number" },
            ]}
            onSubmit={async (values) => {
              await apiClient.post("/admin/shipping/zones", {
                name: values.name,
                pincodePrefixes: values.pincodePrefixes
                  .split(",")
                  .map((p) => p.trim())
                  .filter(Boolean),
                deliveryFee: Number(values.deliveryFee),
                ...(values.freeAbove ? { freeAbove: Number(values.freeAbove) } : {}),
              });
              invalidate();
            }}
          />
        </div>
      </Panel>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Delivery slots">
          <Table
            headers={["Code", "Label", "Window", "Fee"]}
            rows={(slots.data ?? []).map((slot) => [
              str(slot.code),
              str(slot.label),
              str(slot.windowText),
              formatINR(num(slot.fee)),
            ])}
          />
          <div className="mt-5 border-t border-border pt-5">
            <JsonForm
              submitLabel="Add slot"
              fields={[
                { name: "code", label: "Code", required: true },
                { name: "label", label: "Label", required: true },
                { name: "windowText", label: "Window (e.g. 9 AM – 12 PM)", required: true },
                { name: "fee", label: "Fee", type: "number" },
              ]}
              onSubmit={async (values) => {
                await apiClient.post("/admin/shipping/slots", {
                  code: values.code,
                  label: values.label,
                  windowText: values.windowText,
                  fee: Number(values.fee || 0),
                });
                invalidate();
              }}
            />
          </div>
        </Panel>
        <Panel title="Gift wraps">
          <Table
            headers={["Code", "Name", "Price"]}
            rows={(wraps.data ?? []).map((wrap) => [
              str(wrap.code),
              str(wrap.name),
              formatINR(num(wrap.price)),
            ])}
          />
          <div className="mt-5 border-t border-border pt-5">
            <JsonForm
              submitLabel="Add wrap"
              fields={[
                { name: "code", label: "Code", required: true },
                { name: "name", label: "Name", required: true },
                { name: "description", label: "Description" },
                { name: "price", label: "Price", type: "number", required: true },
              ]}
              onSubmit={async (values) => {
                await apiClient.post("/admin/shipping/wraps", {
                  code: values.code,
                  name: values.name,
                  description: values.description,
                  price: Number(values.price),
                });
                invalidate();
              }}
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function ReviewsSection() {
  const { data, isLoading } = useAdminPagedList<Row>("reviews", "/admin/reviews?limit=50");
  const invalidate = useInvalidateAdmin();
  const moderate = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiClient.patch(`/admin/reviews/${encodeURIComponent(id)}`, { status }),
    onSuccess: invalidate,
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <Panel title="Product reviews">
      <Table
        headers={["Rating", "Title", "Author", "Status", "Action"]}
        rows={(data?.items ?? []).map((review) => [
          `${num(review.rating)} ★`,
          str(review.title),
          str(review.user?.name),
          str(review.status),
          <Button
            key={review.id as string}
            size="sm"
            variant="outline"
            onClick={() => {
              void moderate
                .mutateAsync({
                  id: str(review.id),
                  status: review.status === "APPROVED" ? "REJECTED" : "APPROVED",
                })
                .then(() => toast.success("Review updated"));
            }}
          >
            {review.status === "APPROVED" ? "Reject" : "Approve"}
          </Button>,
        ])}
      />
    </Panel>
  );
}

function BannersSection() {
  const { data, isLoading } = useAdminPagedList<Row>("banners", "/admin/banners?limit=50");
  const invalidate = useInvalidateAdmin();
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <div className="space-y-6">
      <Panel title="Banners">
        <Table
          headers={["Title", "Position", "Link", "Active", ""]}
          rows={(data?.items ?? []).map((banner) => [
            str(banner.title),
            num(banner.position),
            str(banner.link),
            banner.isActive ? "Yes" : "No",
            <Button
              key={banner.id as string}
              size="sm"
              variant="outline"
              onClick={() => {
                void apiClient
                  .delete(`/admin/banners/${encodeURIComponent(str(banner.id))}`)
                  .then(() => {
                    invalidate();
                    toast.success("Banner deleted");
                  });
              }}
            >
              Delete
            </Button>,
          ])}
        />
      </Panel>
      <Panel title="Add banner">
        <JsonForm
          submitLabel="Add banner"
          fields={[
            { name: "title", label: "Title", required: true },
            { name: "subtitle", label: "Subtitle" },
            { name: "imageUrl", label: "Image URL", required: true },
            { name: "link", label: "Link" },
            { name: "position", label: "Position", type: "number" },
          ]}
          onSubmit={async (values) => {
            await apiClient.post("/admin/banners", {
              title: values.title,
              ...(values.subtitle ? { subtitle: values.subtitle } : {}),
              imageUrl: values.imageUrl,
              ...(values.link ? { link: values.link } : {}),
              position: Number(values.position || 0),
            });
            invalidate();
          }}
        />
      </Panel>
    </div>
  );
}

function SettingsSection() {
  const { data, isLoading } = useAdminList<Row[]>("settings", "/admin/store-settings?limit=100");
  const invalidate = useInvalidateAdmin();
  const [key, setKey] = useState("");
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <div className="space-y-6">
      <Panel title="Store settings">
        <Table
          headers={["Key", "Value", "Description"]}
          rows={(data ?? []).map((setting) => [
            <code key="key" className="text-xs">
              {str(setting.key)}
            </code>,
            <span key="value" className="block max-w-md truncate text-xs">
              {JSON.stringify(setting.value)}
            </span>,
            str(setting.description),
          ])}
        />
      </Panel>
      <Panel title="Add setting">
        <p className="mb-4 text-sm text-muted-foreground">
          Keys may contain letters, numbers, dots, dashes and underscores. Use a{" "}
          <code>public.</code> prefix to expose a value to the storefront.
        </p>
        <JsonForm
          submitLabel="Add setting"
          fields={[
            { name: "key", label: "Key", required: true, placeholder: "public.new_flag" },
            {
              name: "value",
              label: "JSON value",
              required: true,
              placeholder: '{"enabled":true}',
            },
            { name: "description", label: "Description" },
          ]}
          onSubmit={async (values) => {
            await apiClient.post("/admin/store-settings", {
              key: values.key,
              value: parseJsonObject(values.value),
              ...(values.description ? { description: values.description } : {}),
            });
            invalidate();
          }}
        />
      </Panel>
      <Panel title="Update a setting">
        <p className="mb-4 text-sm text-muted-foreground">
          Values are JSON. Public-facing keys start with <code>public.</code>. The server uses these
          values when pricing orders — changing them changes live storefront behaviour.
        </p>
        <JsonForm
          submitLabel="Save setting"
          fields={[
            { name: "key", label: "Key", required: true, placeholder: "public.tax_rate" },
            {
              name: "value",
              label: "JSON value",
              required: true,
              placeholder: '{"mode":"PERCENT","rate":0,"label":"Tax"}',
            },
          ]}
          onSubmit={async (values) => {
            const value = parseJsonObject(values.value);
            await apiClient.patch(`/admin/store-settings/${encodeURIComponent(values.key)}`, {
              value,
            });
            setKey("");
            invalidate();
          }}
        />
        <div className="mt-4 flex gap-2">
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Key to delete"
            className="h-10 flex-1 rounded-xl border border-input bg-background px-3 text-sm"
          />
          <Button
            variant="outline"
            onClick={() => {
              if (!key) return;
              void apiClient.delete(`/admin/store-settings/${encodeURIComponent(key)}`).then(() => {
                invalidate();
                setKey("");
                toast.success("Setting deleted");
              });
            }}
          >
            Delete
          </Button>
        </div>
      </Panel>
    </div>
  );
}

function UsersSection() {
  const { data, isLoading } = useAdminPagedList<Row>("users", "/users?limit=50");
  const invalidate = useInvalidateAdmin();
  const create = useMutation({
    mutationFn: (values: FormValues) =>
      apiClient.post("/users/staff", {
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        password: values.password,
        roles: values.roles
          .split(",")
          .map((role) => role.trim().toUpperCase())
          .filter(Boolean),
      }),
    onSuccess: invalidate,
  });
  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch(`/users/${encodeURIComponent(id)}/active`, { isActive }),
    onSuccess: invalidate,
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <div className="space-y-6">
      <Panel title="Add staff account">
        <JsonForm
          submitLabel="Create staff account"
          fields={[
            { name: "name", label: "Name", required: true, placeholder: "Store manager" },
            { name: "email", label: "Email", type: "email", required: true },
            {
              name: "password",
              label: "Temporary password",
              type: "password",
              required: true,
              placeholder: "At least 8 characters",
            },
            {
              name: "roles",
              label: "Roles (comma separated)",
              required: true,
              defaultValue: "STORE_MANAGER",
              placeholder: "STORE_MANAGER, ORDER_MANAGER",
            },
          ]}
          onSubmit={async (values) => {
            await create.mutateAsync(values);
          }}
        />
      </Panel>
      <Panel title="Users">
        <Table
          headers={["Name", "Email", "Roles", "Status", ""]}
          rows={(data?.items ?? []).map((user) => [
            str(user.name),
            str(user.email),
            Array.isArray(user.roles) ? user.roles.join(", ") : "—",
            user.isActive ? "Active" : "Disabled",
            <Button
              key={user.id as string}
              size="sm"
              variant="outline"
              onClick={() => {
                void toggle
                  .mutateAsync({ id: str(user.id), isActive: !user.isActive })
                  .then(() => toast.success(user.isActive ? "Account disabled" : "Account enabled"))
                  .catch((error: unknown) =>
                    toast.error(error instanceof Error ? error.message : "Update failed"),
                  );
              }}
            >
              {user.isActive ? "Disable" : "Enable"}
            </Button>,
          ])}
        />
      </Panel>
    </div>
  );
}
