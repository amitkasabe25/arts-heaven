import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";

/**
 * TanStack Query keeps a separate cache per browser tab. An admin write in one
 * tab therefore cannot invalidate an already-open storefront tab on its own.
 * A localStorage write fires a `storage` event in every other same-origin tab,
 * which gives us a cheap cross-tab invalidation signal without a server cache.
 */
const INVALIDATION_KEY = "artsheaven:data:invalidated";

export function broadcastDataInvalidation(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INVALIDATION_KEY, `${Date.now()}-${Math.random()}`);
  } catch {
    // Private browsing or a full storage quota must not break the admin write.
  }
}

export function useQueryInvalidationSync(queryClient: QueryClient): void {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onStorage = (event: StorageEvent) => {
      if (event.key === INVALIDATION_KEY) {
        void queryClient.invalidateQueries();
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [queryClient]);
}
