export interface ApiEnvelope<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
  errors?: Record<string, string[]>;
  code?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export class ApiSuccess<T> implements ApiEnvelope<T> {
  success = true as const;
  constructor(
    public message: string,
    public data: T,
    public meta?: Record<string, unknown>,
  ) {}
}

export function isApiEnvelope(value: unknown): value is ApiEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    typeof (value as ApiEnvelope).success === 'boolean'
  );
}
