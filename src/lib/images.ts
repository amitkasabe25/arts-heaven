import hero from "@/assets/hero.png";
import aboutStudio from "@/assets/about-studio.jpg";
import buildBox from "@/assets/build-box.jpg";
import freshRoses from "@/assets/products/fresh-roses.jpg";
import freshTulips from "@/assets/products/fresh-tulips.jpg";
import artificialPeony from "@/assets/products/artificial-peony.jpg";
import crochetBouquet from "@/assets/products/crochet-bouquet.jpg";
import chocoFerrero from "@/assets/products/choco-ferrero.jpg";
import chocoBars from "@/assets/products/choco-bars.jpg";
import teddyLavender from "@/assets/products/teddy-lavender.jpg";
import plushBunny from "@/assets/products/plush-bunny.jpg";
import customMug from "@/assets/products/custom-mug.jpg";
import customFrame from "@/assets/products/custom-frame.jpg";
import hamperDeluxe from "@/assets/products/hamper-deluxe.jpg";
import hamperMini from "@/assets/products/hamper-mini.jpg";

export const SITE_IMAGES = { hero, aboutStudio, buildBox };

/** Product photo library, keyed so stored products keep working across builds. */
export const PRODUCT_IMAGES = {
  "fresh-roses": freshRoses,
  "fresh-tulips": freshTulips,
  "artificial-peony": artificialPeony,
  "crochet-bouquet": crochetBouquet,
  "choco-ferrero": chocoFerrero,
  "choco-bars": chocoBars,
  "teddy-lavender": teddyLavender,
  "plush-bunny": plushBunny,
  "custom-mug": customMug,
  "custom-frame": customFrame,
  "hamper-deluxe": hamperDeluxe,
  "hamper-mini": hamperMini,
} as const;

export type ImageKey = keyof typeof PRODUCT_IMAGES;
export const IMAGE_KEYS = Object.keys(PRODUCT_IMAGES) as ImageKey[];

/** Resolve a stored image reference: a library key, or a full URL added in admin. */
export function resolveImage(ref: string): string {
  if (ref in PRODUCT_IMAGES) return PRODUCT_IMAGES[ref as ImageKey];
  return ref;
}
