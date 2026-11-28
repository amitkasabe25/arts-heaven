/**
 * Browser-side client for the NestJS API.
 *
 * - Reads the base URL from VITE_API_BASE_URL (see .env.example).
 * - Unwraps the { success, message, data, meta } envelope.
 * - Keeps the access token in memory and the rotating refresh token in
 *   localStorage. Access-token refreshes are coalesced so concurrent queries
 *   never rotate the same token twice.
 * - Sends a stable X-Guest-Token so carts survive login/refresh and can be
 *   merged into a user cart by the server.
 */

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  tokenType?: string;
}

export interface ApiErrorPayload {
  success: false;
  message: string;
  data: null;
  code?: string;
  errors?: Record<string, string[]>;
}

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PaginationMeta;
  errors?: Record<string, string[]>;
  code?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PagedResult<T> {
  items: T;
  meta?: PaginationMeta;
}

const STORAGE = {
  refresh: "artsheaven:v1:refreshToken",
  guest: "artsheaven:v1:guestToken",
} as const;

const configuredBase = import.meta.env["VITE_API_BASE_URL"];
export const API_BASE_URL = String(configuredBase ?? "http://localhost:4000/api/v1").replace(
  /\/$/,
  "",
);

const listeners = new Set<() => void>();
let accessToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;

function storageGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private browsing / blocked storage: the app still works for this tab.
  }
}

function storageRemove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function emitAuthChange(): void {
  for (const listener of listeners) listener();
}

export function subscribeAuth(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Stable snapshot for useSyncExternalStore. */
export function getAuthSnapshot(): string | null {
  return accessToken;
}

export function getServerSnapshot(): null {
  return null;
}

export function getRefreshToken(): string | null {
  return storageGet(STORAGE.refresh);
}

export function hasAuthSession(): boolean {
  return getRefreshToken() !== null;
}

export function setAuthSession(session: AuthSession): void {
  accessToken = session.accessToken;
  storageSet(STORAGE.refresh, session.refreshToken);
  emitAuthChange();
}

export function clearAuthSession(): void {
  accessToken = null;
  storageRemove(STORAGE.refresh);
  emitAuthChange();
}

export function getGuestToken(): string {
  let token = storageGet(STORAGE.guest);
  if (!token) {
    token =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    storageSet(STORAGE.guest, token);
  }
  return token;
}

export function newIdempotencyKey(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly errors?: Record<string, string[]>;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message || `Request failed (${status})`);
    this.name = "ApiError";
    this.status = status;
    if (payload.code) this.code = payload.code;
    if (payload.errors) this.errors = payload.errors;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  const token = getRefreshToken();
  if (!token) return null;

  refreshInFlight = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: token }),
      });
      const text = await response.text();
      const body = text ? (JSON.parse(text) as ApiEnvelope<AuthSession>) : null;
      if (!response.ok || !body?.success) {
        clearAuthSession();
        return null;
      }
      accessToken = body.data.accessToken;
      storageSet(STORAGE.refresh, body.data.refreshToken);
      emitAuthChange();
      return accessToken;
    } catch {
      clearAuthSession();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export interface RequestConfig extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Set to false for endpoints that must not send the guest token. */
  guest?: boolean;
  /** Internal: prevents an endless refresh loop. */
  retried?: boolean;
}

async function requestEnvelope<T>(
  path: string,
  config: RequestConfig = {},
): Promise<ApiEnvelope<T>> {
  const { body, guest = true, retried = false, headers: configHeaders, ...rest } = config;
  const headers = new Headers(configHeaders);
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (guest) headers.set("X-Guest-Token", getGuestToken());
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers,
    body: body === undefined ? null : isFormData ? body : JSON.stringify(body),
  });

  if (response.status === 401 && !retried && getRefreshToken()) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return requestEnvelope<T>(path, { ...config, retried: true });
  }

  const text = await response.text();
  const bodyPayload = text
    ? (JSON.parse(text) as Partial<ApiEnvelope<T>> & Partial<ApiErrorPayload>)
    : null;
  if (!response.ok || !bodyPayload || bodyPayload.success === false) {
    throw new ApiError(response.status, {
      success: false,
      message: bodyPayload?.message ?? `Request failed (${response.status})`,
      data: null,
      ...(bodyPayload?.code ? { code: bodyPayload.code } : {}),
      ...(bodyPayload?.errors ? { errors: bodyPayload.errors } : {}),
    });
  }
  return bodyPayload as ApiEnvelope<T>;
}

async function request<T>(path: string, config: RequestConfig = {}): Promise<T> {
  return (await requestEnvelope<T>(path, config)).data;
}

export interface Paginated<T> {
  items: T[];
  meta?: { page: number; limit: number; total: number; totalPages: number };
}

export const apiClient = {
  get<T>(path: string, config?: RequestConfig) {
    return request<T>(path, { ...config, method: "GET" });
  },
  /** List endpoints whose response carries a { page, limit, total, totalPages } meta block. */
  getPaged<T>(path: string, config?: RequestConfig) {
    return requestEnvelope<T>(path, { ...config, method: "GET" }).then(({ data, meta }) => ({
      items: data,
      meta,
    }));
  },
  post<T>(path: string, body?: unknown, config?: RequestConfig) {
    return request<T>(path, { ...config, method: "POST", body });
  },
  /** Multipart upload; the browser sets the Content-Type boundary itself. */
  upload<T>(path: string, form: FormData, config?: RequestConfig) {
    return request<T>(path, { ...config, method: "POST", body: form });
  },
  patch<T>(path: string, body?: unknown, config?: RequestConfig) {
    return request<T>(path, { ...config, method: "PATCH", body });
  },
  delete<T>(path: string, config?: RequestConfig) {
    return request<T>(path, { ...config, method: "DELETE" });
  },
};
