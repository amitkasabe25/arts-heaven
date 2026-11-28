import type { ImageKey } from "@/lib/images";

export interface Category {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  image: string;
  visible: boolean;
}

export const OCCASIONS = [
  { id: "birthday", name: "Birthday", emoji: "🎂" },
  { id: "anniversary", name: "Anniversary", emoji: "💍" },
  { id: "love", name: "Love & Romance", emoji: "💜" },
  { id: "thank-you", name: "Thank You", emoji: "🌷" },
  { id: "congratulations", name: "Congratulations", emoji: "🎉" },
  { id: "just-because", name: "Just Because", emoji: "✨" },
] as const;

export type OccasionId = (typeof OCCASIONS)[number]["id"];

export interface ProductSize {
  label: string;
  extra: number;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: number;
  compareAt?: number;
  images: string[];
  rating: number;
  reviews: number;
  popularity: number;
  description: string;
  highlights: string[];
  occasions: OccasionId[];
  tags: ("bestseller" | "new" | "limited")[];
  stock: number;
  personalizable: boolean;
  sizes: ProductSize[];
  createdAt: string;
  active: boolean;
}

export const SEED_CATEGORIES: Category[] = [
  {
    slug: "fresh-flowers",
    name: "Fresh Flower Bouquets",
    tagline: "Hand-tied this morning",
    description:
      "Garden roses, tulips and lilies, wrapped by hand and delivered the same day they're picked.",
    image: "fresh-roses",
    visible: true,
  },
  {
    slug: "artificial-flowers",
    name: "Artificial Flower Bouquets",
    tagline: "Blooms that stay forever",
    description:
      "Silk peonies and crochet florals that never wilt — a keepsake as lovely on day 300 as day one.",
    image: "artificial-peony",
    visible: true,
  },
  {
    slug: "chocolate-bouquets",
    name: "Chocolate Bouquets",
    tagline: "Sweeter than roses",
    description:
      "Truffles and bars arranged like a bouquet, finished in pastel paper and satin ribbon.",
    image: "choco-ferrero",
    visible: true,
  },
  {
    slug: "soft-toys",
    name: "Teddy Bears & Soft Toys",
    tagline: "Cuddles, delivered",
    description:
      "Cloud-soft teddies and bunnies in dreamy pastels — the hug you can't give in person.",
    image: "teddy-lavender",
    visible: true,
  },
  {
    slug: "customized-gifts",
    name: "Customized Gifts",
    tagline: "Made just for them",
    description:
      "Mugs, frames and keepsakes printed with their name, your photo or a little private joke.",
    image: "custom-mug",
    visible: true,
  },
  {
    slug: "gift-hampers",
    name: "Gift Hampers & Boxes",
    tagline: "A little box of joy",
    description:
      "Curated boxes of treats, candles and cuddles — beautifully packed and ready to open.",
    image: "hamper-deluxe",
    visible: true,
  },
  {
    slug: "phone-case",
    name: "Customized Phone Cases",
    tagline: "A little piece of you",
    description:
      "Make your phone uniquely yours with personalized photo cases, custom designs and memories printed just for you.",
    image: "phone-case",
    visible: true,
  },
];

type Seed = Omit<
  Product,
  "id" | "slug" | "createdAt" | "active" | "images" | "sizes" | "personalizable" | "tags"
> & {
  slug: string;
  images: ImageKey[];
  sizes?: ProductSize[];
  personalizable?: boolean;
  tags?: Product["tags"];
};

const STANDARD_SIZES: ProductSize[] = [
  { label: "Regular", extra: 0 },
  { label: "Deluxe", extra: 100 },
];

const seeds: Seed[] = [
  // Fresh flowers
  {
    slug: "blush-garden-rose-bouquet",
    name: "Blush Garden Rose Bouquet",
    category: "fresh-flowers",
    price: 449,
    compareAt: 549,
    images: ["fresh-roses", "fresh-tulips", "artificial-peony"],
    rating: 4.9,
    reviews: 312,
    popularity: 98,
    description:
      "Ten blush garden roses cloud-wrapped with baby's breath in lavender Korean paper and a cream satin bow.",
    highlights: [
      "10 fresh garden roses",
      "Baby's breath filler",
      "Lavender Korean wrap",
      "Free care card",
    ],
    occasions: ["love", "anniversary", "birthday"],
    tags: ["bestseller"],
    stock: 24,
    sizes: STANDARD_SIZES,
  },
  {
    slug: "lilac-tulip-whisper",
    name: "Lilac Tulip Whisper",
    category: "fresh-flowers",
    price: 399,
    images: ["fresh-tulips", "fresh-roses", "crochet-bouquet"],
    rating: 4.8,
    reviews: 186,
    popularity: 90,
    description:
      "White and lilac tulips with silver-dollar eucalyptus, wrapped in soft tissue for a fresh, airy look.",
    highlights: ["12 tulips", "Fresh eucalyptus", "Tissue & lilac wrap"],
    occasions: ["thank-you", "congratulations", "just-because"],
    tags: ["new"],
    stock: 18,
    sizes: STANDARD_SIZES,
  },
  {
    slug: "petite-rose-posy",
    name: "Petite Rose Posy",
    category: "fresh-flowers",
    price: 199,
    images: ["fresh-roses", "fresh-tulips"],
    rating: 4.7,
    reviews: 241,
    popularity: 85,
    description: "A sweet hand-tied posy of three pink roses — small in size, big on feeling.",
    highlights: ["3 pink roses", "Gypsophila sprigs", "Ribbon tie"],
    occasions: ["just-because", "love", "thank-you"],
    stock: 40,
  },
  {
    slug: "dreamy-tulip-mini",
    name: "Dreamy Tulip Mini",
    category: "fresh-flowers",
    price: 249,
    images: ["fresh-tulips", "fresh-roses"],
    rating: 4.6,
    reviews: 98,
    popularity: 70,
    description:
      "Five lilac tulips in a mini bouquet, perfect for desks, bedside tables and sudden smiles.",
    highlights: ["5 lilac tulips", "Mini wrap", "Same-day delivery"],
    occasions: ["birthday", "just-because"],
    stock: 6,
  },
  // Artificial
  {
    slug: "forever-peony-bouquet",
    name: "Forever Peony Bouquet",
    category: "artificial-flowers",
    price: 479,
    compareAt: 599,
    images: ["artificial-peony", "fresh-roses", "crochet-bouquet"],
    rating: 4.9,
    reviews: 204,
    popularity: 94,
    description:
      "Lifelike silk peonies in blush and lavender with faux lavender sprigs. Never wilts, never fades.",
    highlights: ["9 silk peonies", "Faux lavender", "Satin wrap", "Lasts for years"],
    occasions: ["anniversary", "love", "birthday"],
    tags: ["bestseller"],
    stock: 15,
    sizes: STANDARD_SIZES,
  },
  {
    slug: "crochet-tulip-daisy-bouquet",
    name: "Crochet Tulip & Daisy Bouquet",
    category: "artificial-flowers",
    price: 459,
    images: ["crochet-bouquet", "artificial-peony", "fresh-tulips"],
    rating: 5.0,
    reviews: 158,
    popularity: 96,
    description:
      "Hand-crocheted lavender tulips and white daisies, wrapped in kraft and lilac paper. Made stitch by stitch.",
    highlights: ["Handmade crochet", "7 tulips + 6 daisies", "Kraft & lilac wrap"],
    occasions: ["love", "thank-you", "just-because"],
    tags: ["bestseller", "limited"],
    stock: 9,
  },
  {
    slug: "single-crochet-tulip",
    name: "Single Crochet Tulip",
    category: "artificial-flowers",
    price: 99,
    images: ["crochet-bouquet", "artificial-peony"],
    rating: 4.7,
    reviews: 389,
    popularity: 88,
    description:
      "One lavender crochet tulip in a cellophane sleeve — the tiniest, most lasting 'thinking of you'.",
    highlights: ["Handmade", "Gift sleeve", "Mini message tag"],
    occasions: ["just-because", "thank-you"],
    stock: 60,
  },
  {
    slug: "silk-peony-trio",
    name: "Silk Peony Trio",
    category: "artificial-flowers",
    price: 299,
    images: ["artificial-peony", "crochet-bouquet"],
    rating: 4.5,
    reviews: 72,
    popularity: 62,
    description: "Three silk peony stems in blush tones, ready to sit in a vase all year round.",
    highlights: ["3 silk stems", "Blush & lilac", "Matte wrap"],
    occasions: ["congratulations", "birthday"],
    tags: ["new"],
    stock: 20,
  },
  // Chocolate
  {
    slug: "golden-truffle-bouquet",
    name: "Golden Truffle Bouquet",
    category: "chocolate-bouquets",
    price: 499,
    compareAt: 649,
    images: ["choco-ferrero", "choco-bars", "hamper-mini"],
    rating: 4.9,
    reviews: 276,
    popularity: 97,
    description:
      "Fourteen gold-foil hazelnut truffles nestled like blooms, wrapped in deep lavender and white.",
    highlights: ["14 hazelnut truffles", "Dried filler flowers", "Lavender wrap"],
    occasions: ["birthday", "anniversary", "congratulations"],
    tags: ["bestseller"],
    stock: 12,
  },
  {
    slug: "pink-choco-bar-bouquet",
    name: "Pink Choco-Bar Bouquet",
    category: "chocolate-bouquets",
    price: 429,
    images: ["choco-bars", "choco-ferrero"],
    rating: 4.8,
    reviews: 143,
    popularity: 87,
    description:
      "Milk chocolate and wafer bars with tiny paper roses, wrapped in blush pink for the sweet tooth.",
    highlights: ["20+ chocolate bars", "Paper rose accents", "Blush wrap"],
    occasions: ["birthday", "just-because"],
    stock: 14,
  },
  {
    slug: "mini-truffle-bunch",
    name: "Mini Truffle Bunch",
    category: "chocolate-bouquets",
    price: 249,
    images: ["choco-ferrero", "hamper-mini"],
    rating: 4.6,
    reviews: 121,
    popularity: 76,
    description: "Six golden truffles in a hand-sized bouquet — a little sparkle for any day.",
    highlights: ["6 truffles", "Mini lilac wrap"],
    occasions: ["thank-you", "congratulations"],
    stock: 30,
  },
  {
    slug: "sweetheart-choco-posy",
    name: "Sweetheart Choco Posy",
    category: "chocolate-bouquets",
    price: 149,
    images: ["choco-bars", "choco-ferrero"],
    rating: 4.4,
    reviews: 67,
    popularity: 58,
    description: "Three chocolate bars and a paper rose tied with satin — a pocket-sized surprise.",
    highlights: ["3 chocolate bars", "Paper rose", "Satin tie"],
    occasions: ["love", "just-because"],
    tags: ["new"],
    stock: 4,
  },
  // Soft toys
  {
    slug: "lavender-heart-teddy",
    name: "Lavender Heart Teddy",
    category: "soft-toys",
    price: 399,
    images: ["teddy-lavender", "plush-bunny", "hamper-deluxe"],
    rating: 4.9,
    reviews: 295,
    popularity: 95,
    description: "A cloud-soft lavender bear holding a satin heart. 30 cm of pure cuddle.",
    highlights: ["30 cm tall", "Satin heart", "Hypoallergenic fill"],
    occasions: ["love", "birthday", "anniversary"],
    tags: ["bestseller"],
    stock: 22,
    sizes: [
      { label: "30 cm", extra: 0 },
      { label: "45 cm", extra: 100 },
    ],
  },
  {
    slug: "blush-bunny-plush",
    name: "Blush Bunny Plush",
    category: "soft-toys",
    price: 349,
    images: ["plush-bunny", "teddy-lavender"],
    rating: 4.8,
    reviews: 168,
    popularity: 89,
    description: "Floppy-eared pastel pink bunny with a little bow, made from ultra-soft velboa.",
    highlights: ["28 cm tall", "Floppy ears", "Washable"],
    occasions: ["birthday", "just-because"],
    stock: 17,
  },
  {
    slug: "pocket-teddy",
    name: "Pocket Teddy",
    category: "soft-toys",
    price: 129,
    images: ["teddy-lavender", "plush-bunny"],
    rating: 4.6,
    reviews: 210,
    popularity: 80,
    description: "A palm-sized lavender teddy — clips onto bags, sits on desks, steals hearts.",
    highlights: ["12 cm", "Bag clip", "Gift pouch"],
    occasions: ["just-because", "thank-you"],
    stock: 55,
  },
  {
    slug: "bunny-and-blooms-duo",
    name: "Bunny & Blooms Duo",
    category: "soft-toys",
    price: 489,
    images: ["plush-bunny", "fresh-roses"],
    rating: 4.7,
    reviews: 54,
    popularity: 66,
    description: "Our blush bunny paired with a petite rose posy — cuddles and flowers in one go.",
    highlights: ["Blush bunny", "3-rose posy", "Shared wrap"],
    occasions: ["birthday", "love"],
    tags: ["limited"],
    stock: 3,
  },
  // Customized
  {
    slug: "always-name-mug",
    name: "'Always' Personalised Mug",
    category: "customized-gifts",
    price: 299,
    images: ["custom-mug", "hamper-mini"],
    rating: 4.8,
    reviews: 187,
    popularity: 86,
    description:
      "Glossy ceramic mug with a lavender heart and a name or word of your choice in handwritten script.",
    highlights: ["325 ml ceramic", "Your text, printed", "Dishwasher safe"],
    occasions: ["birthday", "thank-you", "love"],
    stock: 35,
    personalizable: true,
  },
  {
    slug: "fairy-light-photo-frame",
    name: "Fairy-Light Photo Frame",
    category: "customized-gifts",
    price: 469,
    compareAt: 549,
    images: ["custom-frame", "custom-mug"],
    rating: 4.9,
    reviews: 132,
    popularity: 91,
    description:
      "Wooden frame edged with pressed flowers and warm fairy lights, printed with your favourite photo.",
    highlights: ["5×7 photo print", "Warm LED lights", "Pressed florals"],
    occasions: ["anniversary", "love", "birthday"],
    tags: ["bestseller"],
    stock: 11,
    personalizable: true,
  },
  {
    slug: "name-keepsake-tag",
    name: "Name Keepsake Tag",
    category: "customized-gifts",
    price: 149,
    images: ["custom-mug", "custom-frame"],
    rating: 4.5,
    reviews: 76,
    popularity: 60,
    description: "A little lilac acrylic tag engraved with a name — for keys, bags or bouquets.",
    highlights: ["Acrylic", "Engraved name", "Satin loop"],
    occasions: ["just-because", "congratulations"],
    tags: ["new"],
    stock: 48,
    personalizable: true,
  },
  {
    slug: "couple-memory-frame",
    name: "Couple Memory Frame",
    category: "customized-gifts",
    price: 399,
    images: ["custom-frame", "fresh-roses"],
    rating: 4.7,
    reviews: 89,
    popularity: 72,
    description:
      "Your photo plus a date that matters, printed under glass with a pressed-flower border.",
    highlights: ["Custom date & names", "Glass front", "Table stand"],
    occasions: ["anniversary", "love"],
    stock: 8,
    personalizable: true,
  },
  // Hampers
  {
    slug: "lavender-dream-hamper",
    name: "Lavender Dream Hamper",
    category: "gift-hampers",
    price: 499,
    compareAt: 699,
    images: ["hamper-deluxe", "hamper-mini", "teddy-lavender"],
    rating: 4.9,
    reviews: 221,
    popularity: 93,
    description:
      "A lilac box of truffles, a soy candle, a mini teddy, dried flowers and a handwritten note.",
    highlights: ["6 truffles", "Soy candle", "Mini teddy", "Dried posy"],
    occasions: ["birthday", "anniversary", "thank-you"],
    tags: ["bestseller"],
    stock: 10,
  },
  {
    slug: "macaron-love-box",
    name: "Macaron Love Box",
    category: "gift-hampers",
    price: 299,
    images: ["hamper-mini", "hamper-deluxe"],
    rating: 4.7,
    reviews: 134,
    popularity: 82,
    description: "Pink keepsake box with macarons and heart chocolates, tied in lavender satin.",
    highlights: ["3 macarons", "3 chocolates", "Satin ribbon"],
    occasions: ["love", "thank-you", "just-because"],
    stock: 26,
  },
  {
    slug: "self-care-sunday-box",
    name: "Self-Care Sunday Box",
    category: "gift-hampers",
    price: 449,
    images: ["hamper-deluxe", "hamper-mini"],
    rating: 4.8,
    reviews: 64,
    popularity: 68,
    description: "Bath bomb, lilac candle, scrunchies and chocolate — a slow evening in a box.",
    highlights: ["Bath bomb", "Soy candle", "Satin scrunchies", "Chocolate"],
    occasions: ["just-because", "congratulations"],
    tags: ["new"],
    stock: 13,
  },
  {
    slug: "tiny-treat-box",
    name: "Tiny Treat Box",
    category: "gift-hampers",
    price: 179,
    images: ["hamper-mini", "choco-ferrero"],
    rating: 4.5,
    reviews: 92,
    popularity: 64,
    description:
      "A palm-sized box of chocolates and one macaron — proof that small gifts land big.",
    highlights: ["4 chocolates", "1 macaron", "Mini card"],
    occasions: ["thank-you", "birthday"],
    stock: 2,
  },
  {
    slug: "custom-chocolate-bouquet",
    name: "Custom Chocolate Bouquet",
    category: "chocolate-bouquets",
    price: 399,
    compareAt: 449,
    images: ["custom-chocolate", "choco-bars"],
    rating: 4.8,
    reviews: 24,
    popularity: 70,
    description:
      "Silk, wafer and dark chocolate bars fanned out with baby's breath, wrapped in lilac paper with a satin bow and a tag carrying their name.",
    highlights: [
      "9 assorted chocolate bars",
      "Baby's breath filler",
      "Lilac wrap & satin bow",
      "Personalised name tag",
    ],
    occasions: ["birthday", "love"],
    stock: 20,
    personalizable: true,
    sizes: STANDARD_SIZES,
    tags: ["new"],
  },
  // Phone cases
  {
    slug: "custom-photo-phone-case",
    name: "Custom Photo Phone Case",
    category: "phone-case",
    price: 349,
    compareAt: 449,
    images: ["phone-case"],
    rating: 4.7,
    reviews: 18,
    popularity: 66,
    description:
      "A crystal-clear case printed with your favourite photo and their name in handwritten script. We'll message you for the photo and phone model after you order.",
    highlights: [
      "Your photo, printed edge to edge",
      "Name in handwritten script",
      "Shock-absorbing clear edges",
      "Fits most popular models",
    ],
    occasions: ["birthday", "love", "just-because"],
    stock: 30,
    personalizable: true,
    tags: ["new"],
  },
];

export const SEED_PRODUCTS: Product[] = seeds.map((s, i) => ({
  ...s,
  id: `p${String(i + 1).padStart(3, "0")}`,
  images: s.images,
  sizes: s.sizes ?? [],
  personalizable: s.personalizable ?? false,
  tags: s.tags ?? [],
  createdAt: new Date(Date.UTC(2026, 9, 1 + i)).toISOString(),
  active: true,
}));

/* ---------- Orders ---------- */

export type OrderStatus = "placed" | "preparing" | "out-for-delivery" | "delivered" | "cancelled";

export const ORDER_STATUSES: { id: OrderStatus; label: string }[] = [
  { id: "placed", label: "Placed" },
  { id: "preparing", label: "Preparing" },
  { id: "out-for-delivery", label: "Out for delivery" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
];

export interface OrderLine {
  name: string;
  qty: number;
  unitPrice: number;
  image: string;
  details?: string;
}

export interface Order {
  id: string;
  createdAt: string;
  status: OrderStatus;
  mine: boolean;
  customer: { name: string; email: string; phone: string };
  recipient: { name: string; phone: string; address: string; city: string; pincode: string };
  delivery: { date: string; slotId: string };
  giftWrapId: string;
  cardMessage: string;
  paymentMethod: string;
  lines: OrderLine[];
  totals: {
    subtotal: number;
    discount: number;
    delivery: number;
    wrap: number;
    slotFee: number;
    /** Present on server-backed orders; legacy seed orders omit it. */
    tax?: number;
    total: number;
  };
}

const seedCustomers = [
  ["Ananya Iyer", "Bengaluru"],
  ["Rohan Mehta", "Mumbai"],
  ["Priya Sharma", "Delhi"],
  ["Kabir Khan", "Pune"],
  ["Meera Nair", "Kochi"],
  ["Ishaan Gupta", "Jaipur"],
  ["Sara D'Souza", "Goa"],
  ["Aarav Patel", "Ahmedabad"],
  ["Diya Reddy", "Hyderabad"],
  ["Vikram Singh", "Chandigarh"],
] as const;

const statusCycle: OrderStatus[] = [
  "delivered",
  "delivered",
  "out-for-delivery",
  "preparing",
  "placed",
  "delivered",
  "cancelled",
  "delivered",
];

export const SEED_ORDERS: Order[] = Array.from({ length: 16 }, (_, i) => {
  const [name, city] = seedCustomers[i % seedCustomers.length]!;
  const p1 = SEED_PRODUCTS[(i * 5) % SEED_PRODUCTS.length]!;
  const p2 = SEED_PRODUCTS[(i * 7 + 3) % SEED_PRODUCTS.length]!;
  const lines: OrderLine[] = [{ name: p1.name, qty: 1, unitPrice: p1.price, image: p1.images[0]! }];
  if (i % 3 !== 0)
    lines.push({ name: p2.name, qty: 1 + (i % 2), unitPrice: p2.price, image: p2.images[0]! });
  const subtotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const delivery = subtotal >= 499 ? 0 : 49;
  const wrap = i % 4 === 0 ? 29 : 0;
  const created = new Date(Date.UTC(2026, 10, 20 - i, 9 + (i % 8), 15));
  const deliveryDate = new Date(created.getTime() + 86400000);
  return {
    id: `AH-${(10480 + i * 7).toString()}`,
    createdAt: created.toISOString(),
    status: statusCycle[i % statusCycle.length]!,
    mine: false,
    customer: {
      name,
      email: name.toLowerCase().replace(/[^a-z]+/g, ".") + "@example.com",
      phone: `98${String(45678901 + i * 1311).slice(0, 8)}`,
    },
    recipient: {
      name,
      phone: `97${String(12345678 + i * 977).slice(0, 8)}`,
      address: `${12 + i}, Lavender Lane`,
      city,
      pincode: `${560001 + i}`,
    },
    delivery: {
      date: deliveryDate.toISOString().slice(0, 10),
      slotId: ["morning", "evening", "afternoon", "midnight"][i % 4]!,
    },
    giftWrapId: wrap ? "satin" : "classic",
    cardMessage: "Happy to have you in my life 💜",
    paymentMethod: ["UPI", "Card", "Cash on delivery"][i % 3]!,
    lines,
    totals: {
      subtotal,
      discount: 0,
      delivery,
      wrap,
      slotFee: i % 4 === 3 ? 79 : 0,
      total: subtotal + delivery + wrap + (i % 4 === 3 ? 79 : 0),
    },
  };
});

/* ---------- Analytics sample data ---------- */

export const MONTHLY_SALES = [
  { month: "Jun", revenue: 48200, orders: 162 },
  { month: "Jul", revenue: 52900, orders: 175 },
  { month: "Aug", revenue: 61400, orders: 198 },
  { month: "Sep", revenue: 58700, orders: 191 },
  { month: "Oct", revenue: 72300, orders: 236 },
  { month: "Nov", revenue: 86900, orders: 281 },
];

export const WEEKLY_TRAFFIC = [
  { day: "Mon", visitors: 1240, conversions: 38 },
  { day: "Tue", visitors: 1380, conversions: 41 },
  { day: "Wed", visitors: 1190, conversions: 35 },
  { day: "Thu", visitors: 1520, conversions: 52 },
  { day: "Fri", visitors: 1870, conversions: 67 },
  { day: "Sat", visitors: 2240, conversions: 84 },
  { day: "Sun", visitors: 2010, conversions: 73 },
];

export const OCCASION_SHARE = [
  { name: "Birthday", value: 34 },
  { name: "Love & Romance", value: 27 },
  { name: "Anniversary", value: 16 },
  { name: "Thank You", value: 10 },
  { name: "Congratulations", value: 7 },
  { name: "Just Because", value: 6 },
];

export const FAQS = [
  {
    group: "Orders & delivery",
    items: [
      {
        q: "Do you offer same-day delivery?",
        a: "Yes — orders placed before 2 PM can be delivered the same day in most cities. Fresh flowers are always hand-tied on the day of delivery.",
      },
      {
        q: "What is the midnight surprise slot?",
        a: "We'll deliver between 11:30 PM and midnight so your gift arrives right as the special day begins. It carries a small ₹79 fee.",
      },
      {
        q: "How much does delivery cost?",
        a: "Delivery is ₹49, and free on every order of ₹499 or more.",
      },
      {
        q: "Can I choose a delivery date in advance?",
        a: "Absolutely. Pick any date up to 30 days ahead at checkout along with your preferred time window.",
      },
    ],
  },
  {
    group: "Gifts & personalisation",
    items: [
      {
        q: "Can I add a handwritten greeting card?",
        a: "Every order includes a free greeting card. Type your message in the cart and our team writes it by hand.",
      },
      {
        q: "How do personalised gifts work?",
        a: "On personalised products you'll see a text field — enter the name or message you'd like printed. We'll match it to the design shown.",
      },
      {
        q: "What's in Build Your Own Gift Box?",
        a: "Pick a box size, then fill it with treats, plushies, blooms and keepsakes. The price updates as you go.",
      },
    ],
  },
  {
    group: "Payments & returns",
    items: [
      {
        q: "Which payment methods do you accept?",
        a: "We accept UPI, cards and wallets through Razorpay or Cashfree, plus cash on delivery where available. Card details are collected by the payment provider, never by this store.",
      },
      {
        q: "What if my flowers arrive damaged?",
        a: "Send us a photo within 24 hours and we'll replace the bouquet or refund you — no questions asked.",
      },
      {
        q: "Do you have discount codes?",
        a: "Active offers are shown in the announcement bar. Enter a code in your cart and the server confirms the exact discount before you pay.",
      },
    ],
  },
];
