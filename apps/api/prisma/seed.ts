/**
 * Artsheaven development seed.
 *
 * Run from apps/api:  npm run prisma:seed
 *
 * Design rules:
 *  - Every seeded row has a stable id or a natural unique key (slug/code/key),
 *    so running this file repeatedly converges on the same state.
 *  - Values mirror src/lib/catalog.ts and src/lib/pricing.ts. Frontend modules
 *    are NOT imported at runtime; image references are plain `/images/...`
 *    strings and no binary data is uploaded.
 *  - Money is written with Prisma.Decimal (fixed point), never floats.
 *  - Roles/permissions come from src/roles/roles.constants.ts so the seeded
 *    RBAC data cannot drift from the guards.
 *  - This resets catalogue/pricing data on re-run. Admin-adjusted stock,
 *    orders and users' passwords are never overwritten by the seed.
 */
import {
  CustomizationFieldType,
  Prisma,
  PrismaClient,
  ProductStatus,
  ProductType,
  RoleName,
  StockMovement,
} from '@prisma/client';
import { hash as bcryptHash } from 'bcryptjs';
import { PERMISSION_KEYS, ROLE_PERMISSIONS } from '../src/roles/roles.constants';

const prisma = new PrismaClient();

/** Fixed-point Decimal for all Decimal(12,2) columns. */
const dec = (value: number | string): Prisma.Decimal =>
  new Prisma.Decimal(typeof value === 'number' ? value.toFixed(2) : value);

/** Explicit JSON cast for Prisma Json/JSONB columns. */
const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

const slug = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const productImage = (key: string): string =>
  `/images/products/${key}.${key === 'phone-case' || key === 'custom-chocolate' ? 'png' : 'jpg'}`;

const humanize = (value: string): string =>
  value
    .split(/[._-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

const CATEGORIES = [
  {
    slug: 'fresh-flowers',
    name: 'Fresh Flower Bouquets',
    tagline: 'Hand-tied this morning',
    description:
      "Garden roses, tulips and lilies, wrapped by hand and delivered the same day they're picked.",
    image: 'fresh-roses',
    displayOrder: 1,
  },
  {
    slug: 'artificial-flowers',
    name: 'Artificial Flower Bouquets',
    tagline: 'Blooms that stay forever',
    description:
      'Silk peonies and crochet florals that never wilt — a keepsake as lovely on day 300 as day one.',
    image: 'artificial-peony',
    displayOrder: 2,
  },
  {
    slug: 'chocolate-bouquets',
    name: 'Chocolate Bouquets',
    tagline: 'Sweeter than roses',
    description:
      'Truffles and bars arranged like a bouquet, finished in pastel paper and satin ribbon.',
    image: 'choco-ferrero',
    displayOrder: 3,
  },
  {
    slug: 'soft-toys',
    name: 'Teddy Bears & Soft Toys',
    tagline: 'Cuddles, delivered',
    description:
      'Cloud-soft teddies and bunnies in dreamy pastels — the hug you can’t give in person.',
    image: 'teddy-lavender',
    displayOrder: 4,
  },
  {
    slug: 'customized-gifts',
    name: 'Customized Gifts',
    tagline: 'Made just for them',
    description:
      'Mugs, frames and keepsakes printed with their name, your photo or a little private joke.',
    image: 'custom-mug',
    displayOrder: 5,
  },
  {
    slug: 'gift-hampers',
    name: 'Gift Hampers & Boxes',
    tagline: 'A little box of joy',
    description:
      'Curated boxes of treats, candles and cuddles — beautifully packed and ready to open.',
    image: 'hamper-deluxe',
    displayOrder: 6,
  },
  {
    slug: 'phone-case',
    name: 'Customized Phone Cases',
    tagline: 'A little piece of you',
    description:
      'Make your phone uniquely yours with personalized photo cases, custom designs and memories printed just for you.',
    image: 'phone-case',
    displayOrder: 7,
  },
  {
    slug: 'personalized-jewelry',
    name: 'Personalized Jewelry',
    tagline: 'Wear your story',
    description:
      'Engraved pendants, bracelets and rings made with names, dates and birthstones — keepsakes they can wear every day.',
    image: 'custom-frame',
    displayOrder: 8,
  },
] as const;

const STANDARD_SIZES = [
  { label: 'Regular', extra: 0 },
  { label: 'Deluxe', extra: 100 },
];

const TEDDY_SIZES = [
  { label: '30 cm', extra: 0 },
  { label: '45 cm', extra: 100 },
];

type SeedProduct = {
  slug: string;
  name: string;
  categorySlug: string;
  price: number;
  compareAt?: number;
  images: string[];
  rating: number;
  reviews: number;
  description: string;
  highlights: string[];
  occasions: string[];
  tags: string[];
  stock: number;
  sizes?: Array<{ label: string; extra: number }>;
  personalizable?: boolean;
};

// Names, prices, descriptions, ratings and sizes are copied from
// src/lib/catalog.ts. The two *-jewelry items are new seeds for the eighth
// required category (the frontend catalogue has no jewelry products yet).
const PRODUCTS: SeedProduct[] = [
  {
    slug: 'blush-garden-rose-bouquet',
    name: 'Blush Garden Rose Bouquet',
    categorySlug: 'fresh-flowers',
    price: 449,
    compareAt: 549,
    images: ['fresh-roses', 'fresh-tulips', 'artificial-peony'],
    rating: 4.9,
    reviews: 312,
    description:
      "Ten blush garden roses cloud-wrapped with baby's breath in lavender Korean paper and a cream satin bow.",
    highlights: ['10 fresh garden roses', "Baby's breath filler", 'Lavender Korean wrap', 'Free care card'],
    occasions: ['love', 'anniversary', 'birthday'],
    tags: ['bestseller'],
    stock: 24,
    sizes: STANDARD_SIZES,
  },
  {
    slug: 'lilac-tulip-whisper',
    name: 'Lilac Tulip Whisper',
    categorySlug: 'fresh-flowers',
    price: 399,
    images: ['fresh-tulips', 'fresh-roses', 'crochet-bouquet'],
    rating: 4.8,
    reviews: 186,
    description:
      'White and lilac tulips with silver-dollar eucalyptus, wrapped in soft tissue for a fresh, airy look.',
    highlights: ['12 tulips', 'Fresh eucalyptus', 'Tissue & lilac wrap'],
    occasions: ['thank-you', 'congratulations', 'just-because'],
    tags: ['new'],
    stock: 18,
    sizes: STANDARD_SIZES,
  },
  {
    slug: 'petite-rose-posy',
    name: 'Petite Rose Posy',
    categorySlug: 'fresh-flowers',
    price: 199,
    images: ['fresh-roses', 'fresh-tulips'],
    rating: 4.7,
    reviews: 241,
    description: 'A sweet hand-tied posy of three pink roses — small in size, big on feeling.',
    highlights: ['3 pink roses', 'Gypsophila sprigs', 'Ribbon tie'],
    occasions: ['just-because', 'love', 'thank-you'],
    tags: [],
    stock: 40,
  },
  {
    slug: 'dreamy-tulip-mini',
    name: 'Dreamy Tulip Mini',
    categorySlug: 'fresh-flowers',
    price: 249,
    images: ['fresh-tulips', 'fresh-roses'],
    rating: 4.6,
    reviews: 98,
    description:
      'Five lilac tulips in a mini bouquet, perfect for desks, bedside tables and sudden smiles.',
    highlights: ['5 lilac tulips', 'Mini wrap', 'Same-day delivery'],
    occasions: ['birthday', 'just-because'],
    tags: [],
    stock: 6,
  },
  {
    slug: 'forever-peony-bouquet',
    name: 'Forever Peony Bouquet',
    categorySlug: 'artificial-flowers',
    price: 479,
    compareAt: 599,
    images: ['artificial-peony', 'fresh-roses', 'crochet-bouquet'],
    rating: 4.9,
    reviews: 204,
    description:
      'Lifelike silk peonies in blush and lavender with faux lavender sprigs. Never wilts, never fades.',
    highlights: ['9 silk peonies', 'Faux lavender', 'Satin wrap', 'Lasts for years'],
    occasions: ['anniversary', 'love', 'birthday'],
    tags: ['bestseller'],
    stock: 15,
    sizes: STANDARD_SIZES,
  },
  {
    slug: 'crochet-tulip-daisy-bouquet',
    name: 'Crochet Tulip & Daisy Bouquet',
    categorySlug: 'artificial-flowers',
    price: 459,
    images: ['crochet-bouquet', 'artificial-peony', 'fresh-tulips'],
    rating: 5.0,
    reviews: 158,
    description:
      'Hand-crocheted lavender tulips and white daisies, wrapped in kraft and lilac paper. Made stitch by stitch.',
    highlights: ['Handmade crochet', '7 tulips + 6 daisies', 'Kraft & lilac wrap'],
    occasions: ['love', 'thank-you', 'just-because'],
    tags: ['bestseller', 'limited'],
    stock: 9,
  },
  {
    slug: 'single-crochet-tulip',
    name: 'Single Crochet Tulip',
    categorySlug: 'artificial-flowers',
    price: 99,
    images: ['crochet-bouquet', 'artificial-peony'],
    rating: 4.7,
    reviews: 389,
    description:
      'One lavender crochet tulip in a cellophane sleeve — the tiniest, most lasting “thinking of you”.',
    highlights: ['Handmade', 'Gift sleeve', 'Mini message tag'],
    occasions: ['just-because', 'thank-you'],
    tags: [],
    stock: 60,
  },
  {
    slug: 'silk-peony-trio',
    name: 'Silk Peony Trio',
    categorySlug: 'artificial-flowers',
    price: 299,
    images: ['artificial-peony', 'crochet-bouquet'],
    rating: 4.5,
    reviews: 72,
    description: 'Three silk peony stems in blush tones, ready to sit in a vase all year round.',
    highlights: ['3 silk stems', 'Blush & lilac', 'Matte wrap'],
    occasions: ['congratulations', 'birthday'],
    tags: ['new'],
    stock: 20,
  },
  {
    slug: 'golden-truffle-bouquet',
    name: 'Golden Truffle Bouquet',
    categorySlug: 'chocolate-bouquets',
    price: 499,
    compareAt: 649,
    images: ['choco-ferrero', 'choco-bars', 'hamper-mini'],
    rating: 4.9,
    reviews: 276,
    description:
      'Fourteen gold-foil hazelnut truffles nestled like blooms, wrapped in deep lavender and white.',
    highlights: ['14 hazelnut truffles', 'Dried filler flowers', 'Lavender wrap'],
    occasions: ['birthday', 'anniversary', 'congratulations'],
    tags: ['bestseller'],
    stock: 12,
  },
  {
    slug: 'pink-choco-bar-bouquet',
    name: 'Pink Choco-Bar Bouquet',
    categorySlug: 'chocolate-bouquets',
    price: 429,
    images: ['choco-bars', 'choco-ferrero'],
    rating: 4.8,
    reviews: 143,
    description:
      'Milk chocolate and wafer bars with tiny paper roses, wrapped in blush pink for the sweet tooth.',
    highlights: ['20+ chocolate bars', 'Paper rose accents', 'Blush wrap'],
    occasions: ['birthday', 'just-because'],
    tags: [],
    stock: 14,
  },
  {
    slug: 'mini-truffle-bunch',
    name: 'Mini Truffle Bunch',
    categorySlug: 'chocolate-bouquets',
    price: 249,
    images: ['choco-ferrero', 'hamper-mini'],
    rating: 4.6,
    reviews: 121,
    description: 'Six golden truffles in a hand-sized bouquet — a little sparkle for any day.',
    highlights: ['6 truffles', 'Mini lilac wrap'],
    occasions: ['thank-you', 'congratulations'],
    tags: [],
    stock: 30,
  },
  {
    slug: 'sweetheart-choco-posy',
    name: 'Sweetheart Choco Posy',
    categorySlug: 'chocolate-bouquets',
    price: 149,
    images: ['choco-bars', 'choco-ferrero'],
    rating: 4.4,
    reviews: 67,
    description: 'Three chocolate bars and a paper rose tied with satin — a pocket-sized surprise.',
    highlights: ['3 chocolate bars', 'Paper rose', 'Satin tie'],
    occasions: ['love', 'just-because'],
    tags: ['new'],
    stock: 4,
  },
  {
    slug: 'lavender-heart-teddy',
    name: 'Lavender Heart Teddy',
    categorySlug: 'soft-toys',
    price: 399,
    images: ['teddy-lavender', 'plush-bunny', 'hamper-deluxe'],
    rating: 4.9,
    reviews: 295,
    description: 'A cloud-soft lavender bear holding a satin heart. 30 cm of pure cuddle.',
    highlights: ['30 cm tall', 'Satin heart', 'Hypoallergenic fill'],
    occasions: ['love', 'birthday', 'anniversary'],
    tags: ['bestseller'],
    stock: 22,
    sizes: TEDDY_SIZES,
  },
  {
    slug: 'blush-bunny-plush',
    name: 'Blush Bunny Plush',
    categorySlug: 'soft-toys',
    price: 349,
    images: ['plush-bunny', 'teddy-lavender'],
    rating: 4.8,
    reviews: 168,
    description: 'Floppy-eared pastel pink bunny with a little bow, made from ultra-soft velboa.',
    highlights: ['28 cm tall', 'Floppy ears', 'Washable'],
    occasions: ['birthday', 'just-because'],
    tags: [],
    stock: 17,
  },
  {
    slug: 'pocket-teddy',
    name: 'Pocket Teddy',
    categorySlug: 'soft-toys',
    price: 129,
    images: ['teddy-lavender', 'plush-bunny'],
    rating: 4.6,
    reviews: 210,
    description: 'A palm-sized lavender teddy — clips onto bags, sits on desks, steals hearts.',
    highlights: ['12 cm', 'Bag clip', 'Gift pouch'],
    occasions: ['just-because', 'thank-you'],
    tags: [],
    stock: 55,
  },
  {
    slug: 'bunny-and-blooms-duo',
    name: 'Bunny & Blooms Duo',
    categorySlug: 'soft-toys',
    price: 489,
    images: ['plush-bunny', 'fresh-roses'],
    rating: 4.7,
    reviews: 54,
    description: 'Our blush bunny paired with a petite rose posy — cuddles and flowers in one go.',
    highlights: ['Blush bunny', '3-rose posy', 'Shared wrap'],
    occasions: ['birthday', 'love'],
    tags: ['limited'],
    stock: 3,
  },
  {
    slug: 'always-name-mug',
    name: "'Always' Personalised Mug",
    categorySlug: 'customized-gifts',
    price: 299,
    images: ['custom-mug', 'hamper-mini'],
    rating: 4.8,
    reviews: 187,
    description:
      'Glossy ceramic mug with a lavender heart and a name or word of your choice in handwritten script.',
    highlights: ['325 ml ceramic', 'Your text, printed', 'Dishwasher safe'],
    occasions: ['birthday', 'thank-you', 'love'],
    tags: [],
    stock: 35,
    personalizable: true,
  },
  {
    slug: 'fairy-light-photo-frame',
    name: 'Fairy-Light Photo Frame',
    categorySlug: 'customized-gifts',
    price: 469,
    compareAt: 549,
    images: ['custom-frame', 'custom-mug'],
    rating: 4.9,
    reviews: 132,
    description:
      'Wooden frame edged with pressed flowers and warm fairy lights, printed with your favourite photo.',
    highlights: ['5×7 photo print', 'Warm LED lights', 'Pressed florals'],
    occasions: ['anniversary', 'love', 'birthday'],
    tags: ['bestseller'],
    stock: 11,
    personalizable: true,
  },
  {
    slug: 'name-keepsake-tag',
    name: 'Name Keepsake Tag',
    categorySlug: 'customized-gifts',
    price: 149,
    images: ['custom-mug', 'custom-frame'],
    rating: 4.5,
    reviews: 76,
    description: 'A little lilac acrylic tag engraved with a name — for keys, bags or bouquets.',
    highlights: ['Acrylic', 'Engraved name', 'Satin loop'],
    occasions: ['just-because', 'congratulations'],
    tags: ['new'],
    stock: 48,
    personalizable: true,
  },
  {
    slug: 'couple-memory-frame',
    name: 'Couple Memory Frame',
    categorySlug: 'customized-gifts',
    price: 399,
    images: ['custom-frame', 'fresh-roses'],
    rating: 4.7,
    reviews: 89,
    description:
      'Your photo plus a date that matters, printed under glass with a pressed-flower border.',
    highlights: ['Custom date & names', 'Glass front', 'Table stand'],
    occasions: ['anniversary', 'love'],
    tags: [],
    stock: 8,
    personalizable: true,
  },
  {
    slug: 'lavender-dream-hamper',
    name: 'Lavender Dream Hamper',
    categorySlug: 'gift-hampers',
    price: 499,
    compareAt: 699,
    images: ['hamper-deluxe', 'hamper-mini', 'teddy-lavender'],
    rating: 4.9,
    reviews: 221,
    description:
      'A lilac box of truffles, a soy candle, a mini teddy, dried flowers and a handwritten note.',
    highlights: ['6 truffles', 'Soy candle', 'Mini teddy', 'Dried posy'],
    occasions: ['birthday', 'anniversary', 'thank-you'],
    tags: ['bestseller'],
    stock: 10,
  },
  {
    slug: 'macaron-love-box',
    name: 'Macaron Love Box',
    categorySlug: 'gift-hampers',
    price: 299,
    images: ['hamper-mini', 'hamper-deluxe'],
    rating: 4.7,
    reviews: 134,
    description: 'Pink keepsake box with macarons and heart chocolates, tied in lavender satin.',
    highlights: ['3 macarons', '3 chocolates', 'Satin ribbon'],
    occasions: ['love', 'thank-you', 'just-because'],
    tags: [],
    stock: 26,
  },
  {
    slug: 'self-care-sunday-box',
    name: 'Self-Care Sunday Box',
    categorySlug: 'gift-hampers',
    price: 449,
    images: ['hamper-deluxe', 'hamper-mini'],
    rating: 4.8,
    reviews: 64,
    description: 'Bath bomb, lilac candle, scrunchies and chocolate — a slow evening in a box.',
    highlights: ['Bath bomb', 'Soy candle', 'Satin scrunchies', 'Chocolate'],
    occasions: ['just-because', 'congratulations'],
    tags: ['new'],
    stock: 13,
  },
  {
    slug: 'tiny-treat-box',
    name: 'Tiny Treat Box',
    categorySlug: 'gift-hampers',
    price: 179,
    images: ['hamper-mini', 'choco-ferrero'],
    rating: 4.5,
    reviews: 92,
    description:
      'A palm-sized box of chocolates and one macaron — proof that small gifts land big.',
    highlights: ['4 chocolates', '1 macaron', 'Mini card'],
    occasions: ['thank-you', 'birthday'],
    tags: [],
    stock: 2,
  },
  {
    slug: 'custom-chocolate-bouquet',
    name: 'Custom Chocolate Bouquet',
    categorySlug: 'chocolate-bouquets',
    price: 399,
    compareAt: 449,
    images: ['custom-chocolate', 'choco-bars'],
    rating: 4.8,
    reviews: 24,
    description:
      'Silk, wafer and dark chocolate bars fanned out with baby’s breath, wrapped in lilac paper with a satin bow and a tag carrying their name.',
    highlights: [
      '9 assorted chocolate bars',
      "Baby's breath filler",
      'Lilac wrap & satin bow',
      'Personalised name tag',
    ],
    occasions: ['birthday', 'love'],
    tags: ['new'],
    stock: 20,
    sizes: STANDARD_SIZES,
    personalizable: true,
  },
  {
    slug: 'custom-photo-phone-case',
    name: 'Custom Photo Phone Case',
    categorySlug: 'phone-case',
    price: 349,
    compareAt: 449,
    images: ['phone-case'],
    rating: 4.7,
    reviews: 18,
    description:
      'A crystal-clear case printed with your favourite photo and their name in handwritten script. We’ll message you for the photo and phone model after you order.',
    highlights: [
      'Your photo, printed edge to edge',
      'Name in handwritten script',
      'Shock-absorbing clear edges',
      'Fits most popular models',
    ],
    occasions: ['birthday', 'love', 'just-because'],
    tags: ['new'],
    stock: 30,
    personalizable: true,
  },
  {
    slug: 'engraved-name-pendant',
    name: 'Engraved Name Pendant',
    categorySlug: 'personalized-jewelry',
    price: 899,
    compareAt: 1099,
    images: ['custom-frame', 'custom-mug'],
    rating: 4.8,
    reviews: 46,
    description:
      'A delicate pendant engraved with a name or word of your choice, finished in sterling silver or gold plating and gift-boxed.',
    highlights: ['Engraved up to 12 characters', 'Sterling silver base', 'Gift box included'],
    occasions: ['birthday', 'anniversary', 'love'],
    tags: ['new'],
    stock: 14,
    personalizable: true,
  },
  {
    slug: 'birthstone-charm-bracelet',
    name: 'Birthstone Charm Bracelet',
    categorySlug: 'personalized-jewelry',
    price: 749,
    images: ['custom-frame', 'fresh-roses'],
    rating: 4.7,
    reviews: 31,
    description:
      'An adjustable chain with an engraved initial and a birthstone charm — a tiny, everyday reminder of someone special.',
    highlights: ['Adjustable 16–19 cm', 'Engraved initial', 'Choice of 12 birthstones'],
    occasions: ['birthday', 'just-because', 'love'],
    tags: ['new'],
    stock: 18,
    personalizable: true,
  },
];

type OptionSeed = { value: string; label: string; priceDelta?: number; hex?: string };

type FieldSeed = {
  key: string;
  label: string;
  type: CustomizationFieldType;
  description?: string;
  placeholder?: string;
  isRequired?: boolean;
  position?: number;
  priceDelta?: number;
  options?: OptionSeed[];
  validation?: Record<string, unknown>;
};

type SchemaSeed = {
  id: string;
  categorySlug: string;
  name: string;
  description: string;
  position: number;
  fields: FieldSeed[];
};

/** Schema-driven customization definitions; options carry their own price deltas. */
const CUSTOMIZATION_SCHEMAS: SchemaSeed[] = [
  {
    id: 'schema_phone_case',
    categorySlug: 'phone-case',
    name: 'Phone case personalisation',
    description: 'Brand, model, case type, uploaded photo, printed text and font.',
    position: 1,
    fields: [
      {
        key: 'brand',
        label: 'Phone brand',
        type: CustomizationFieldType.SINGLE_SELECT,
        isRequired: true,
        options: [
          { value: 'apple', label: 'Apple' },
          { value: 'samsung', label: 'Samsung' },
          { value: 'oneplus', label: 'OnePlus' },
          { value: 'google', label: 'Google' },
          { value: 'other', label: 'Other' },
        ],
      },
      {
        key: 'model',
        label: 'Phone model',
        type: CustomizationFieldType.TEXT,
        isRequired: true,
        placeholder: 'e.g. iPhone 15 Pro',
        validation: { minLength: 2, maxLength: 40 },
      },
      {
        key: 'caseType',
        label: 'Case type',
        type: CustomizationFieldType.SINGLE_SELECT,
        isRequired: true,
        options: [
          { value: 'clear', label: 'Clear', priceDelta: 0 },
          { value: 'frosted', label: 'Frosted', priceDelta: 20 },
          { value: 'tough', label: 'Tough / shock-proof', priceDelta: 60 },
          { value: 'flip', label: 'Flip cover', priceDelta: 80 },
        ],
      },
      {
        key: 'photo',
        label: 'Photo to print',
        type: CustomizationFieldType.IMAGE,
        isRequired: true,
        description: 'Private upload; JPG or PNG up to 10 MB.',
        validation: { maxFiles: 1, accept: ['image/jpeg', 'image/png'], maxBytes: 10485760 },
      },
      {
        key: 'text',
        label: 'Name or caption',
        type: CustomizationFieldType.TEXT,
        placeholder: 'e.g. For Amma, always',
        validation: { maxLength: 24 },
      },
      {
        key: 'font',
        label: 'Font style',
        type: CustomizationFieldType.DROPDOWN,
        options: [
          { value: 'script', label: 'Handwritten script' },
          { value: 'serif', label: 'Classic serif' },
          { value: 'sans', label: 'Modern sans' },
          { value: 'bold', label: 'Bold display', priceDelta: 20 },
        ],
      },
    ],
  },
  {
    id: 'schema_jewelry',
    categorySlug: 'personalized-jewelry',
    name: 'Jewelry personalisation',
    description: 'Engraved name, font, material, colour and size.',
    position: 1,
    fields: [
      {
        key: 'name',
        label: 'Name or initials to engrave',
        type: CustomizationFieldType.TEXT,
        isRequired: true,
        placeholder: 'e.g. Ananya',
        validation: { minLength: 1, maxLength: 20 },
      },
      {
        key: 'font',
        label: 'Engraving font',
        type: CustomizationFieldType.DROPDOWN,
        isRequired: true,
        options: [
          { value: 'script', label: 'Script' },
          { value: 'serif', label: 'Serif' },
          { value: 'sans', label: 'Sans-serif' },
          { value: 'handwritten', label: 'Handwritten', priceDelta: 50 },
        ],
      },
      {
        key: 'material',
        label: 'Material',
        type: CustomizationFieldType.SINGLE_SELECT,
        isRequired: true,
        options: [
          { value: 'sterling-silver', label: 'Sterling silver', priceDelta: 0 },
          { value: 'gold-plated', label: '14K gold plated', priceDelta: 300 },
          { value: 'rose-gold', label: 'Rose gold plated', priceDelta: 350 },
        ],
      },
      {
        key: 'color',
        label: 'Finish colour',
        type: CustomizationFieldType.COLOR,
        options: [
          { value: 'silver', label: 'Silver', hex: '#C0C0C0' },
          { value: 'gold', label: 'Gold', hex: '#D4AF37' },
          { value: 'rose', label: 'Rose gold', hex: '#B76E79' },
        ],
      },
      {
        key: 'size',
        label: 'Size',
        type: CustomizationFieldType.SINGLE_SELECT,
        options: [
          { value: '6', label: '6', priceDelta: 0 },
          { value: '7', label: '7', priceDelta: 0 },
          { value: '8', label: '8', priceDelta: 50 },
          { value: '9', label: '9', priceDelta: 50 },
        ],
      },
    ],
  },
  {
    id: 'schema_bouquet',
    categorySlug: 'fresh-flowers',
    name: 'Bouquet personalisation',
    description: 'Choose flowers, size, wrap, ribbon and a handwritten message.',
    position: 1,
    fields: [
      {
        key: 'flowers',
        label: 'Flowers',
        type: CustomizationFieldType.MULTI_SELECT,
        description: 'Pick as many as you like; price deltas are per bunch.',
        options: [
          { value: 'roses', label: 'Garden roses', priceDelta: 0 },
          { value: 'tulips', label: 'Tulips', priceDelta: 0 },
          { value: 'lilies', label: 'Lilies', priceDelta: 60 },
          { value: 'eucalyptus', label: 'Eucalyptus', priceDelta: 30 },
          { value: 'babys-breath', label: "Baby's breath", priceDelta: 20 },
        ],
        validation: { min: 1, max: 4 },
      },
      {
        key: 'size',
        label: 'Bouquet size',
        type: CustomizationFieldType.SINGLE_SELECT,
        isRequired: true,
        options: [
          { value: 'regular', label: 'Regular', priceDelta: 0 },
          { value: 'deluxe', label: 'Deluxe', priceDelta: 100 },
          { value: 'grand', label: 'Grand', priceDelta: 200 },
        ],
      },
      {
        key: 'wrap',
        label: 'Wrapping paper',
        type: CustomizationFieldType.SINGLE_SELECT,
        options: [
          { value: 'kraft', label: 'Natural kraft', priceDelta: 0 },
          { value: 'white-tissue', label: 'White tissue', priceDelta: 0 },
          { value: 'lavender-korean', label: 'Lavender Korean paper', priceDelta: 30 },
        ],
      },
      {
        key: 'ribbon',
        label: 'Ribbon colour',
        type: CustomizationFieldType.COLOR,
        options: [
          { value: 'cream', label: 'Cream satin', hex: '#F5F0E1' },
          { value: 'lavender', label: 'Lavender satin', hex: '#B57EDC', priceDelta: 10 },
          { value: 'blush', label: 'Blush satin', hex: '#F4C2C2', priceDelta: 10 },
        ],
      },
      {
        key: 'message',
        label: 'Handwritten message',
        type: CustomizationFieldType.TEXTAREA,
        placeholder: 'Write something lovely…',
        validation: { maxLength: 160 },
      },
    ],
  },
  {
    id: 'schema_hamper',
    categorySlug: 'gift-hampers',
    name: 'Gift hamper builder',
    description: 'Selectable products, packaging, ribbon and a handwritten message.',
    position: 1,
    fields: [
      {
        key: 'items',
        label: 'Pick your treats',
        type: CustomizationFieldType.MULTI_SELECT,
        isRequired: true,
        options: [
          { value: 'truffles', label: 'Hazelnut truffles (4)', priceDelta: 89 },
          { value: 'macarons', label: 'French macarons (3)', priceDelta: 99 },
          { value: 'cookies', label: 'Butter heart cookies', priceDelta: 59 },
          { value: 'candy', label: 'Pastel candy jar', priceDelta: 49 },
          { value: 'mini-teddy', label: 'Mini lavender teddy', priceDelta: 129 },
          { value: 'bunny-keychain', label: 'Plush bunny keychain', priceDelta: 79 },
          { value: 'dried-posy', label: 'Dried lavender posy', priceDelta: 99 },
          { value: 'single-rose', label: 'Preserved pink rose', priceDelta: 119 },
          { value: 'candle', label: 'Lilac soy candle', priceDelta: 149 },
          { value: 'scrunchie', label: 'Satin scrunchie set', priceDelta: 69 },
          { value: 'photo-print', label: 'Polaroid photo print', priceDelta: 39 },
          { value: 'bath-bomb', label: 'Lavender bath bomb', priceDelta: 79 },
        ],
        validation: { min: 1, max: 8 },
      },
      {
        key: 'packaging',
        label: 'Packaging',
        type: CustomizationFieldType.SINGLE_SELECT,
        options: [
          { value: 'classic', label: 'Classic tissue', priceDelta: 0 },
          { value: 'satin', label: 'Satin ribbon box', priceDelta: 29 },
          { value: 'luxe', label: 'Luxe keepsake box', priceDelta: 59 },
        ],
      },
      {
        key: 'ribbon',
        label: 'Ribbon colour',
        type: CustomizationFieldType.SINGLE_SELECT,
        options: [
          { value: 'lavender', label: 'Lavender' },
          { value: 'blush', label: 'Blush' },
          { value: 'gold', label: 'Gold', priceDelta: 15 },
        ],
      },
      {
        key: 'message',
        label: 'Card message',
        type: CustomizationFieldType.TEXTAREA,
        validation: { maxLength: 160 },
      },
    ],
  },
  {
    id: 'schema_chocolate_bouquet',
    categorySlug: 'chocolate-bouquets',
    name: 'Chocolate bouquet personalisation',
    description: 'Chocolate selection, count, wrap, ribbon and a name tag.',
    position: 2,
    fields: [
      {
        key: 'chocolateType',
        label: 'Chocolate selection',
        type: CustomizationFieldType.MULTI_SELECT,
        isRequired: true,
        options: [
          { value: 'truffles', label: 'Gold-foil hazelnut truffles', priceDelta: 0 },
          { value: 'milk-bars', label: 'Milk chocolate bars', priceDelta: 0 },
          { value: 'dark-bars', label: 'Dark chocolate bars', priceDelta: 20 },
          { value: 'wafer', label: 'Wafer bars', priceDelta: 10 },
        ],
        validation: { min: 1, max: 4 },
      },
      {
        key: 'count',
        label: 'Number of pieces',
        type: CustomizationFieldType.NUMBER,
        isRequired: true,
        validation: { min: 6, max: 24 },
      },
      {
        key: 'wrap',
        label: 'Wrapping paper',
        type: CustomizationFieldType.SINGLE_SELECT,
        options: [
          { value: 'lavender', label: 'Lavender', priceDelta: 0 },
          { value: 'blush', label: 'Blush pink', priceDelta: 0 },
          { value: 'kraft', label: 'Natural kraft', priceDelta: 0 },
        ],
      },
      {
        key: 'ribbon',
        label: 'Ribbon colour',
        type: CustomizationFieldType.COLOR,
        options: [
          { value: 'cream', label: 'Cream', hex: '#F5F0E1' },
          { value: 'lavender', label: 'Lavender', hex: '#B57EDC' },
          { value: 'gold', label: 'Gold', hex: '#D4AF37' },
        ],
      },
      {
        key: 'nameTag',
        label: 'Name for the tag',
        type: CustomizationFieldType.TEXT,
        validation: { maxLength: 20 },
      },
    ],
  },
  {
    id: 'schema_personalised_gift',
    categorySlug: 'customized-gifts',
    name: 'Personalised gift details',
    description: 'Name, font and message for mugs, frames and keepsakes.',
    position: 1,
    fields: [
      {
        key: 'name',
        label: 'Name or word to print',
        type: CustomizationFieldType.TEXT,
        isRequired: true,
        validation: { minLength: 1, maxLength: 24 },
      },
      {
        key: 'font',
        label: 'Font style',
        type: CustomizationFieldType.DROPDOWN,
        options: [
          { value: 'script', label: 'Handwritten script' },
          { value: 'serif', label: 'Classic serif' },
          { value: 'sans', label: 'Modern sans' },
        ],
      },
      {
        key: 'message',
        label: 'Short message',
        type: CustomizationFieldType.TEXTAREA,
        validation: { maxLength: 120 },
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Seed steps
// ---------------------------------------------------------------------------

async function seedRolesAndPermissions(tx: Prisma.TransactionClient): Promise<void> {
  for (const key of PERMISSION_KEYS) {
    await tx.permission.upsert({
      where: { key },
      create: { key, description: `${humanize(key)} permission` },
      update: { description: `${humanize(key)} permission` },
    });
  }

  for (const roleName of Object.values(RoleName)) {
    const permissions = ROLE_PERMISSIONS[roleName] ?? [];
    const displayName = humanize(roleName);
    const description = `Seeded ${displayName.toLowerCase()} role`;
    await tx.role.upsert({
      where: { name: roleName },
      create: {
        name: roleName,
        displayName,
        description,
        permissions: { connect: permissions.map((key) => ({ key })) },
      },
      update: {
        displayName,
        description,
        permissions: { set: permissions.map((key) => ({ key })) },
      },
    });
  }
}

async function seedCategories(tx: Prisma.TransactionClient): Promise<void> {
  for (const category of CATEGORIES) {
    const data = {
      name: category.name,
      slug: category.slug,
      tagline: category.tagline,
      description: category.description,
      thumbnail: productImage(category.image),
      bannerImage: productImage(category.image),
      seoTitle: `${category.name} | Artsheaven`,
      seoDescription: category.description,
      displayOrder: category.displayOrder,
      isVisible: true,
    };
    await tx.category.upsert({
      where: { slug: category.slug },
      create: { id: `cat_${category.slug}`, ...data },
      update: data,
    });
  }
}

async function seedProducts(tx: Prisma.TransactionClient): Promise<void> {
  for (const [index, product] of PRODUCTS.entries()) {
    const productId = `prod_${product.slug}`;
    const sku = `AH-${String(index + 1).padStart(4, '0')}`;
    const productType = product.personalizable
      ? ProductType.CUSTOMIZABLE
      : product.sizes?.length
        ? ProductType.VARIABLE
        : ProductType.SIMPLE;

    const data = {
      name: product.name,
      sku,
      shortDescription: product.highlights.slice(0, 2).join(' · '),
      description: product.description,
      categoryId: `cat_${product.categorySlug}`,
      basePrice: dec(product.price),
      sellingPrice: dec(product.price),
      compareAtPrice: product.compareAt ? dec(product.compareAt) : null,
      status: ProductStatus.ACTIVE,
      productType,
      isFeatured: product.tags.includes('bestseller'),
      isBestSeller: product.tags.includes('bestseller'),
      trackStock: true,
      stockQty: product.stock,
      lowStockThreshold: 5,
      weightGrams: 450,
      dimensions: json({ lengthCm: 28, widthCm: 20, heightCm: 12 }),
      seoTitle: `${product.name} | Artsheaven`,
      seoDescription: product.description.slice(0, 155),
      ratingAverage: new Prisma.Decimal(product.rating.toFixed(1)),
      ratingCount: product.reviews,
      deletedAt: null,
    };

    await tx.product.upsert({
      where: { slug: product.slug },
      create: { id: productId, slug: product.slug, ...data },
      update: data,
    });

    // Attributes are a simple key/value list used by faceted filtering.
    const attributes: Array<{ key: string; value: string; position: number }> = [];
    product.highlights.forEach((value, position) =>
      attributes.push({ key: 'highlight', value, position }),
    );
    product.occasions.forEach((value, position) =>
      attributes.push({ key: 'occasion', value, position }),
    );
    product.tags.forEach((value, position) => attributes.push({ key: 'tag', value, position }));
    await tx.productAttribute.deleteMany({ where: { productId } });
    await tx.productAttribute.createMany({ data: attributes.map((a) => ({ ...a, productId })) });

    // Images: deterministic ids, cleanup of keys removed from the source list.
    const imageIds = product.images.map((key, position) => `img_${product.slug}_${position}`);
    for (const [position, key] of product.images.entries()) {
      const imageData = {
        url: productImage(key),
        alt: `${product.name} — view ${position + 1}`,
        position,
        isPrimary: position === 0,
      };
      await tx.productImage.upsert({
        where: { id: imageIds[position]! },
        create: { id: imageIds[position]!, productId, ...imageData },
        update: imageData,
      });
    }
    await tx.productImage.deleteMany({
      where: { productId, id: { notIn: imageIds } },
    });

    // Variants for sized products. Product-level stock stays the catalogue total.
    const variantIds: string[] = [];
    for (const [variantIndex, size] of (product.sizes ?? []).entries()) {
      const variantId = `var_${product.slug}_${slug(size.label)}`;
      variantIds.push(variantId);
      const variantData = {
        name: size.label,
        sku: `${sku}-${variantIndex + 1}`,
        options: json({ size: size.label }),
        price: dec(product.price + size.extra),
        compareAtPrice: product.compareAt ? dec(product.compareAt + size.extra) : null,
        stockQty: Math.ceil(product.stock / (product.sizes?.length ?? 1)),
        isActive: true,
        position: variantIndex,
        deletedAt: null,
      };
      await tx.productVariant.upsert({
        where: { id: variantId },
        create: { id: variantId, productId, ...variantData },
        update: variantData,
      });

      const stockKey = `v:${variantId}`;
      const inventory = await tx.inventory.upsert({
        where: { stockKey },
        create: {
          id: `inv_${variantId}`,
          stockKey,
          variantId,
          productId: null,
          quantity: variantData.stockQty,
          lowStockThreshold: 5,
        },
        update: { quantity: variantData.stockQty },
      });
      await seedInitialStockMovement(tx, inventory.id, variantData.stockQty);
    }
    await tx.productVariant.deleteMany({
      where: { productId, id: { notIn: variantIds } },
    });

    // Products without variants get a product-level inventory row.
    if (variantIds.length === 0) {
      const stockKey = `p:${productId}`;
      const inventory = await tx.inventory.upsert({
        where: { stockKey },
        create: {
          id: `inv_${productId}`,
          stockKey,
          productId,
          variantId: null,
          quantity: product.stock,
          lowStockThreshold: 5,
        },
        update: { quantity: product.stock },
      });
      await seedInitialStockMovement(tx, inventory.id, product.stock);
    }
  }
}

async function seedInitialStockMovement(
  tx: Prisma.TransactionClient,
  inventoryId: string,
  quantity: number,
): Promise<void> {
  // No unique key on InventoryTransaction — guard by counting instead.
  const existing = await tx.inventoryTransaction.count({ where: { inventoryId } });
  if (existing === 0) {
    await tx.inventoryTransaction.create({
      data: {
        inventoryId,
        movement: StockMovement.PURCHASE,
        quantity,
        reason: 'Seed initial stock',
        referenceType: 'SEED',
      },
    });
  }
}

async function seedCustomizationSchemas(tx: Prisma.TransactionClient): Promise<void> {
  for (const schema of CUSTOMIZATION_SCHEMAS) {
    const data = {
      categoryId: `cat_${schema.categorySlug}`,
      productId: null,
      name: schema.name,
      description: schema.description,
      isRequired: false,
      position: schema.position,
    };
    await tx.productCustomizationSchema.upsert({
      where: { id: schema.id },
      create: { id: schema.id, ...data },
      update: data,
    });

    const fieldIds: string[] = [];
    for (const [position, field] of schema.fields.entries()) {
      const fieldId = `${schema.id}_field_${field.key}`;
      fieldIds.push(fieldId);
      const fieldData = {
        key: field.key,
        label: field.label,
        type: field.type,
        description: field.description,
        placeholder: field.placeholder,
        isRequired: field.isRequired ?? false,
        position: field.position ?? position,
        options: json(field.options ?? []),
        validation: json(field.validation ?? {}),
        priceDelta: dec(field.priceDelta ?? 0),
      };
      await tx.productCustomizationField.upsert({
        where: { id: fieldId },
        create: { id: fieldId, schemaId: schema.id, ...fieldData },
        update: fieldData,
      });
    }
    await tx.productCustomizationField.deleteMany({
      where: { schemaId: schema.id, id: { notIn: fieldIds } },
    });
  }
}

async function seedPromotionsAndShipping(tx: Prisma.TransactionClient): Promise<void> {
  const coupons = [
    {
      code: 'HEAVEN10',
      type: 'PERCENT' as const,
      value: 10,
      minSubtotal: 299,
      description: '10% off orders above ₹299',
    },
    {
      code: 'FIRSTGIFT',
      type: 'FIXED' as const,
      value: 50,
      minSubtotal: 399,
      description: '₹50 off orders above ₹399',
    },
  ];
  for (const coupon of coupons) {
    const data = {
      ...coupon,
      value: dec(coupon.value),
      minSubtotal: dec(coupon.minSubtotal),
      isActive: true,
      firstOrderOnly: false, // matches the frontend coupon checker exactly
    };
    await tx.coupon.upsert({
      where: { code: coupon.code },
      create: data,
      update: data,
    });
  }

  const zones = [
    {
      id: 'zone_bengaluru',
      name: 'Bengaluru & surroundings',
      pincodePrefixes: ['560'],
      deliveryFee: 49,
      estimatedDaysMin: 1,
      estimatedDaysMax: 1,
      sameDayEligible: true,
    },
    {
      id: 'zone_metros',
      name: 'Major metros',
      pincodePrefixes: ['110', '400', '500', '600', '641', '411', '302', '380'],
      deliveryFee: 49,
      estimatedDaysMin: 2,
      estimatedDaysMax: 3,
      sameDayEligible: false,
    },
    {
      id: 'zone_national',
      name: 'Rest of India',
      pincodePrefixes: ['12', '20', '22', '30', '31', '36', '45', '60', '70', '75', '80', '90'],
      deliveryFee: 49,
      estimatedDaysMin: 3,
      estimatedDaysMax: 6,
      sameDayEligible: false,
    },
  ];
  for (const zone of zones) {
    const data = {
      name: zone.name,
      pincodePrefixes: zone.pincodePrefixes,
      deliveryFee: dec(zone.deliveryFee),
      freeAbove: dec(499),
      estimatedDaysMin: zone.estimatedDaysMin,
      estimatedDaysMax: zone.estimatedDaysMax,
      sameDayEligible: zone.sameDayEligible,
      isActive: true,
    };
    await tx.deliveryZone.upsert({
      where: { id: zone.id },
      create: { id: zone.id, ...data },
      update: data,
    });
  }

  const slots = [
    { code: 'morning', label: 'Morning', windowText: '9 AM – 12 PM', fee: 0, sortOrder: 1 },
    { code: 'afternoon', label: 'Afternoon', windowText: '12 PM – 4 PM', fee: 0, sortOrder: 2 },
    { code: 'evening', label: 'Evening', windowText: '4 PM – 9 PM', fee: 0, sortOrder: 3 },
    {
      code: 'midnight',
      label: 'Midnight surprise',
      windowText: '11:30 PM – 12 AM',
      fee: 79,
      sortOrder: 4,
    },
  ];
  for (const slot of slots) {
    const data = {
      label: slot.label,
      windowText: slot.windowText,
      fee: dec(slot.fee),
      sortOrder: slot.sortOrder,
      isActive: true,
    };
    await tx.deliverySlot.upsert({
      where: { code: slot.code },
      create: { code: slot.code, ...data },
      update: data,
    });
  }

  const wraps = [
    { code: 'classic', name: 'Classic tissue', description: 'Soft white tissue & twine', price: 0 },
    {
      code: 'satin',
      name: 'Satin ribbon',
      description: 'Lavender paper with a satin bow',
      price: 29,
    },
    {
      code: 'luxe',
      name: 'Luxe keepsake box',
      description: 'Rigid lilac box, reusable',
      price: 59,
    },
  ];
  for (const wrap of wraps) {
    const data = { name: wrap.name, description: wrap.description, price: dec(wrap.price), isActive: true };
    await tx.giftWrap.upsert({
      where: { code: wrap.code },
      create: { code: wrap.code, ...data },
      update: data,
    });
  }
}

async function seedSettingsAndBanners(tx: Prisma.TransactionClient): Promise<void> {
  const settings: Array<{ key: string; description: string; value: unknown }> = [
    // Keys prefixed with `public.` are the only store settings exposed to
    // guests. `public.tax_rate` is also read by CheckoutService when pricing an
    // order, so the prefix is required for both the UI and the server.
    {
      key: 'public.tax_rate',
      description: 'Tax applied to order totals (0 = no tax, matching the demo storefront)',
      value: { mode: 'PERCENT', rate: 0, label: 'Tax' },
    },
    {
      key: 'public.free_delivery_threshold',
      description: 'Subtotal at or above which delivery is free',
      value: { amount: 499, currency: 'INR' },
    },
    {
      key: 'public.delivery_fee',
      description: 'Flat delivery fee below the free threshold (server zones take precedence at checkout)',
      value: { amount: 49, currency: 'INR' },
    },
    {
      key: 'public.currency',
      description: 'Store currency',
      value: { code: 'INR' },
    },
    {
      key: 'public.store_name',
      description: 'Public store name',
      value: { name: 'Artsheaven' },
    },
    {
      key: 'public.support_email',
      description: 'Customer support address',
      value: { email: 'hello@artsheaven.local' },
    },
    {
      key: 'public.payment_default_provider',
      description: 'Default checkout provider (sandbox)',
      value: { provider: 'razorpay' },
    },
    {
      key: 'public.build_a_box',
      description: 'Build-your-own-box options; actual prices are recalculated on the server',
      value: {
        sizes: [
          { id: 'petite', capacity: 3, price: 49 },
          { id: 'classic', capacity: 5, price: 79 },
          { id: 'grand', capacity: 8, price: 99 },
        ],
      },
    },
    {
      key: 'public.coupons',
      description: 'Promotional copy only; discounts are always validated and applied by the server',
      value: {
        items: [
          { code: 'HEAVEN10', description: '10% off orders above ₹299' },
          { code: 'FIRSTGIFT', description: '₹50 off orders above ₹399' },
        ],
      },
    },
  ];
  // Remove keys from older seeds so re-running the seed converges exactly.
  await tx.storeSetting.deleteMany({
    where: {
      key: {
        in: [
          'tax_rate',
          'free_delivery_threshold',
          'delivery_fee',
          'currency',
          'store_name',
          'support_email',
          'payment_default_provider',
          'build_a_box',
        ],
      },
    },
  });
  for (const setting of settings) {
    const data = { value: json(setting.value), description: setting.description };
    await tx.storeSetting.upsert({
      where: { key: setting.key },
      create: { key: setting.key, ...data },
      update: data,
    });
  }

  const banners = [
    {
      id: 'banner_hero',
      title: 'Thoughtful gifts, hand-tied with love',
      subtitle: 'Fresh blooms, sweet treats and keepsakes — delivered same day in Bengaluru.',
      imageUrl: '/images/hero.jpg',
      link: '/shop',
      position: 1,
    },
    {
      id: 'banner_forever',
      title: 'Blooms that stay forever',
      subtitle: 'Silk and crochet bouquets, made to outlast the occasion.',
      imageUrl: '/images/products/artificial-peony.jpg',
      link: '/categories/artificial-flowers',
      position: 2,
    },
    {
      id: 'banner_build_box',
      title: 'Build your own gift box',
      subtitle: 'Pick a box, fill it with treats, plushies, blooms and keepsakes.',
      imageUrl: '/images/build-box.jpg',
      link: '/build-a-box',
      position: 3,
    },
  ];
  for (const banner of banners) {
    const data = {
      title: banner.title,
      subtitle: banner.subtitle,
      imageUrl: banner.imageUrl,
      link: banner.link,
      position: banner.position,
      isActive: true,
    };
    await tx.homepageBanner.upsert({
      where: { id: banner.id },
      create: { id: banner.id, ...data },
      update: data,
    });
  }
}

async function seedUsers(tx: Prisma.TransactionClient): Promise<void> {
  const configuredRounds = Number(process.env.BCRYPT_ROUNDS ?? 12);
  const rounds = Number.isFinite(configuredRounds)
    ? Math.min(16, Math.max(8, Math.trunc(configuredRounds)))
    : 12;
  // Demo credentials only. Change immediately in any shared environment.
  const passwordHash = await bcryptHash('ChangeMe123!', rounds);
  const verifiedAt = new Date();

  await tx.user.upsert({
    where: { email: 'admin@artsheaven.local' },
    create: {
      id: 'user_super_admin',
      email: 'admin@artsheaven.local',
      name: 'Artsheaven Admin',
      phone: '9000000001',
      passwordHash,
      emailVerifiedAt: verifiedAt,
      isActive: true,
      roles: { connect: [{ name: RoleName.SUPER_ADMIN }] },
    },
    // Never reset an existing password: operators may have rotated it.
    update: {
      name: 'Artsheaven Admin',
      isActive: true,
      emailVerifiedAt: verifiedAt,
      roles: { set: [{ name: RoleName.SUPER_ADMIN }] },
    },
  });

  await tx.user.upsert({
    where: { email: 'customer@artsheaven.local' },
    create: {
      id: 'user_customer',
      email: 'customer@artsheaven.local',
      name: 'Ananya Iyer',
      phone: '9876543210',
      passwordHash,
      emailVerifiedAt: verifiedAt,
      isActive: true,
      roles: { connect: [{ name: RoleName.CUSTOMER }] },
    },
    update: {
      name: 'Ananya Iyer',
      isActive: true,
      roles: { set: [{ name: RoleName.CUSTOMER }] },
    },
  });

  await tx.address.upsert({
    where: { id: 'addr_customer_home' },
    create: {
      id: 'addr_customer_home',
      userId: 'user_customer',
      label: 'Home',
      name: 'Ananya Iyer',
      phone: '9876543210',
      addressLine: '12, Lavender Lane, Indiranagar',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      isDefault: true,
    },
    update: {
      addressLine: '12, Lavender Lane, Indiranagar',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      isDefault: true,
    },
  });
}

async function main(): Promise<void> {
  console.log('Seeding Artsheaven (idempotent)...');

  await prisma.$transaction(
    async (tx) => {
      await seedRolesAndPermissions(tx);
      await seedCategories(tx);
      await seedProducts(tx);
      await seedCustomizationSchemas(tx);
      await seedPromotionsAndShipping(tx);
      await seedSettingsAndBanners(tx);
      await seedUsers(tx);
    },
    { maxWait: 10_000, timeout: 180_000 },
  );

  console.log(
    `Seed complete: ${CATEGORIES.length} categories, ${PRODUCTS.length} products, ` +
      `${CUSTOMIZATION_SCHEMAS.length} customization schemas, ${PERMISSION_KEYS.length} permissions, 2 users.`,
  );
  console.log('Demo login: admin@artsheaven.local / ChangeMe123! (rotate before sharing).');
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
