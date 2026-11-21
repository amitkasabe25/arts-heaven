import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { SEED_CATEGORIES, SEED_ORDERS, SEED_PRODUCTS, type Category, type Order, type OrderStatus, type Product } from "@/lib/catalog";
import { makeId } from "@/lib/format";

export interface CartLine {
  lineId: string;
  kind: "product" | "box";
  productId?: string;
  name: string;
  image: string;
  unitPrice: number;
  qty: number;
  details?: string;
}

export interface GiftOptions {
  wrapId: string;
  cardMessage: string;
  cardFrom: string;
  couponCode: string;
}

export interface Address {
  id: string;
  label: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  pincode: string;
}

export interface Profile {
  name: string;
  email: string;
  phone: string;
  birthday: string;
  addresses: Address[];
}

export interface Preferences {
  newsletter: boolean;
  smsUpdates: boolean;
  occasionReminders: boolean;
}

interface PersistedState {
  products: Product[];
  categories: Category[];
  cart: CartLine[];
  wishlist: string[];
  orders: Order[];
  gift: GiftOptions;
  profile: Profile;
  prefs: Preferences;
}

const DEFAULT_GIFT: GiftOptions = { wrapId: "classic", cardMessage: "", cardFrom: "", couponCode: "" };
const DEFAULT_PROFILE: Profile = {
  name: "Guest Gifter",
  email: "you@example.com",
  phone: "",
  birthday: "",
  addresses: [],
};
const DEFAULT_PREFS: Preferences = { newsletter: true, smsUpdates: false, occasionReminders: true };

function initialState(): PersistedState {
  return {
    products: SEED_PRODUCTS,
    categories: SEED_CATEGORIES,
    cart: [],
    wishlist: [],
    orders: SEED_ORDERS,
    gift: DEFAULT_GIFT,
    profile: DEFAULT_PROFILE,
    prefs: DEFAULT_PREFS,
  };
}

const STORAGE_PREFIX = "artsheaven:v1:";
const KEYS = ["products", "categories", "cart", "wishlist", "orders", "gift", "profile", "prefs"] as const;

export interface AddToCartOptions {
  qty?: number;
  size?: string;
  sizeExtra?: number;
  personalization?: string;
}

interface StoreValue extends PersistedState {
  hydrated: boolean;
  // cart
  addToCart: (product: Product, opts?: AddToCartOptions) => void;
  addBoxToCart: (line: Omit<CartLine, "lineId" | "kind" | "qty">) => void;
  updateQty: (lineId: string, qty: number) => void;
  removeLine: (lineId: string) => void;
  clearCart: () => void;
  cartCount: number;
  cartSubtotal: number;
  // wishlist
  toggleWishlist: (productId: string) => boolean;
  isWishlisted: (productId: string) => boolean;
  // gift options
  setGift: (patch: Partial<GiftOptions>) => void;
  // orders
  placeOrder: (order: Omit<Order, "id" | "createdAt" | "status" | "mine">) => Order;
  setOrderStatus: (id: string, status: OrderStatus) => void;
  // profile
  setProfile: (patch: Partial<Profile>) => void;
  setPrefs: (patch: Partial<Preferences>) => void;
  // admin
  upsertProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;
  adjustStock: (id: string, delta: number) => void;
  upsertCategory: (category: Category, previousSlug?: string) => void;
  deleteCategory: (slug: string) => void;
  resetDemoData: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const skipFirstWrite = useRef(true);

  // Load persisted state after mount so SSR and first client render match.
  useEffect(() => {
    try {
      const loaded: Partial<PersistedState> = {};
      for (const key of KEYS) {
        const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
        if (raw) (loaded as Record<string, unknown>)[key] = JSON.parse(raw);
      }
      setState((prev) => ({ ...prev, ...loaded }));
    } catch {
      // Corrupt storage: keep defaults.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (skipFirstWrite.current) {
      skipFirstWrite.current = false;
      return;
    }
    for (const key of KEYS) {
      window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(state[key]));
    }
  }, [state, hydrated]);

  const addToCart = useCallback((product: Product, opts: AddToCartOptions = {}) => {
    const qty = opts.qty ?? 1;
    const detailParts = [opts.size, opts.personalization ? `“${opts.personalization}”` : undefined].filter(Boolean);
    const details = detailParts.join(" · ") || undefined;
    const unitPrice = product.price + (opts.sizeExtra ?? 0);
    setState((s) => {
      const existing = s.cart.find((l) => l.productId === product.id && l.details === details);
      if (existing) {
        return { ...s, cart: s.cart.map((l) => (l === existing ? { ...l, qty: Math.min(10, l.qty + qty) } : l)) };
      }
      const line: CartLine = {
        lineId: makeId("L"),
        kind: "product",
        productId: product.id,
        name: product.name,
        image: product.images[0] ?? "",
        unitPrice,
        qty,
        ...(details ? { details } : {}),
      };
      return { ...s, cart: [...s.cart, line] };
    });
  }, []);

  const addBoxToCart = useCallback((line: Omit<CartLine, "lineId" | "kind" | "qty">) => {
    setState((s) => ({ ...s, cart: [...s.cart, { ...line, lineId: makeId("B"), kind: "box", qty: 1 }] }));
  }, []);

  const updateQty = useCallback((lineId: string, qty: number) => {
    setState((s) => ({
      ...s,
      cart: s.cart.map((l) => (l.lineId === lineId ? { ...l, qty: Math.max(1, Math.min(10, qty)) } : l)),
    }));
  }, []);

  const removeLine = useCallback((lineId: string) => {
    setState((s) => ({ ...s, cart: s.cart.filter((l) => l.lineId !== lineId) }));
  }, []);

  const clearCart = useCallback(() => setState((s) => ({ ...s, cart: [], gift: DEFAULT_GIFT })), []);

  const toggleWishlist = useCallback(
    (productId: string) => {
      const adding = !state.wishlist.includes(productId);
      setState((s) => ({
        ...s,
        wishlist: adding ? [...s.wishlist, productId] : s.wishlist.filter((id) => id !== productId),
      }));
      return adding;
    },
    [state.wishlist],
  );

  const isWishlisted = useCallback((id: string) => state.wishlist.includes(id), [state.wishlist]);

  const setGift = useCallback((patch: Partial<GiftOptions>) => setState((s) => ({ ...s, gift: { ...s.gift, ...patch } })), []);

  const placeOrder = useCallback((input: Omit<Order, "id" | "createdAt" | "status" | "mine">) => {
    const order: Order = {
      ...input,
      id: `AH-${Math.floor(20000 + Math.random() * 70000)}`,
      createdAt: new Date().toISOString(),
      status: "placed",
      mine: true,
    };
    setState((s) => {
      // Reduce stock for purchased catalog products.
      const qtyById = new Map<string, number>();
      for (const l of s.cart) if (l.productId) qtyById.set(l.productId, (qtyById.get(l.productId) ?? 0) + l.qty);
      return {
        ...s,
        orders: [order, ...s.orders],
        products: s.products.map((p) => (qtyById.has(p.id) ? { ...p, stock: Math.max(0, p.stock - (qtyById.get(p.id) ?? 0)) } : p)),
        cart: [],
        gift: DEFAULT_GIFT,
      };
    });
    return order;
  }, []);

  const setOrderStatus = useCallback((id: string, status: OrderStatus) => {
    setState((s) => ({ ...s, orders: s.orders.map((o) => (o.id === id ? { ...o, status } : o)) }));
  }, []);

  const setProfile = useCallback((patch: Partial<Profile>) => setState((s) => ({ ...s, profile: { ...s.profile, ...patch } })), []);
  const setPrefs = useCallback((patch: Partial<Preferences>) => setState((s) => ({ ...s, prefs: { ...s.prefs, ...patch } })), []);

  const upsertProduct = useCallback((product: Product) => {
    setState((s) => {
      const exists = s.products.some((p) => p.id === product.id);
      return { ...s, products: exists ? s.products.map((p) => (p.id === product.id ? product : p)) : [product, ...s.products] };
    });
  }, []);

  const deleteProduct = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      products: s.products.filter((p) => p.id !== id),
      wishlist: s.wishlist.filter((w) => w !== id),
      cart: s.cart.filter((l) => l.productId !== id),
    }));
  }, []);

  const adjustStock = useCallback((id: string, delta: number) => {
    setState((s) => ({ ...s, products: s.products.map((p) => (p.id === id ? { ...p, stock: Math.max(0, p.stock + delta) } : p)) }));
  }, []);

  const upsertCategory = useCallback((category: Category, previousSlug?: string) => {
    setState((s) => {
      const key = previousSlug ?? category.slug;
      const exists = s.categories.some((c) => c.slug === key);
      return {
        ...s,
        categories: exists ? s.categories.map((c) => (c.slug === key ? category : c)) : [...s.categories, category],
        products:
          previousSlug && previousSlug !== category.slug
            ? s.products.map((p) => (p.category === previousSlug ? { ...p, category: category.slug } : p))
            : s.products,
      };
    });
  }, []);

  const deleteCategory = useCallback((slug: string) => {
    setState((s) => ({ ...s, categories: s.categories.filter((c) => c.slug !== slug) }));
  }, []);

  const resetDemoData = useCallback(() => {
    setState((s) => ({ ...initialState(), cart: s.cart, wishlist: s.wishlist, profile: s.profile, prefs: s.prefs }));
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      ...state,
      hydrated,
      addToCart,
      addBoxToCart,
      updateQty,
      removeLine,
      clearCart,
      cartCount: state.cart.reduce((n, l) => n + l.qty, 0),
      cartSubtotal: state.cart.reduce((n, l) => n + l.qty * l.unitPrice, 0),
      toggleWishlist,
      isWishlisted,
      setGift,
      placeOrder,
      setOrderStatus,
      setProfile,
      setPrefs,
      upsertProduct,
      deleteProduct,
      adjustStock,
      upsertCategory,
      deleteCategory,
      resetDemoData,
    }),
    [state, hydrated, addToCart, addBoxToCart, updateQty, removeLine, clearCart, toggleWishlist, isWishlisted, setGift, placeOrder, setOrderStatus, setProfile, setPrefs, upsertProduct, deleteProduct, adjustStock, upsertCategory, deleteCategory, resetDemoData],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}

/** Storefront-visible products: active and in a visible category. */
export function useVisibleProducts(): Product[] {
  const { products, categories } = useStore();
  return useMemo(() => {
    const visible = new Set(categories.filter((c) => c.visible).map((c) => c.slug));
    return products.filter((p) => p.active && visible.has(p.category));
  }, [products, categories]);
}
