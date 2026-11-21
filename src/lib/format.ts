export function formatINR(value: number): string {
  return "₹" + Math.round(value).toLocaleString("en-IN");
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function makeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${Date.now().toString(36).slice(-4).toUpperCase()}${rand}`;
}
