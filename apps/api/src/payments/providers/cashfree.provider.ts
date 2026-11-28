import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import { Env } from '../../common/config/env.validation';
import {
  CreatePaymentOrderInput,
  CreateRefundInput,
  CreatedPaymentOrder,
  CreatedRefund,
  PaymentProviderAdapter,
  ProviderPaymentStatus,
} from './payment-provider.interface';

@Injectable()
export class CashfreeProvider implements PaymentProviderAdapter {
  readonly name = PaymentProvider.CASHFREE;
  private readonly logger = new Logger(CashfreeProvider.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  private get baseUrl(): string {
    return this.config.get('CASHFREE_ENVIRONMENT', { infer: true }) === 'PRODUCTION'
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg';
  }

  private credentials(): { clientId: string; clientSecret: string; version: string } {
    const clientId = this.config.get('CASHFREE_CLIENT_ID', { infer: true });
    const clientSecret = this.config.get('CASHFREE_CLIENT_SECRET', { infer: true });
    if (!clientId || !clientSecret)
      throw new ServiceUnavailableException('Cashfree is not configured on this server');
    return {
      clientId,
      clientSecret,
      version: this.config.get('CASHFREE_API_VERSION', { infer: true }),
    };
  }

  private async request<T>(
    path: string,
    init: RequestInit & { method?: string } = {},
  ): Promise<T> {
    const { clientId, clientSecret, version } = this.credentials();
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-client-id': clientId,
        'x-client-secret': clientSecret,
        'x-api-version': version,
        ...(init.headers ?? {}),
      },
    });
    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!response.ok)
      throw new ServiceUnavailableException(
        `Cashfree request failed (${response.status}): ${typeof body === 'object' && body && 'message' in body ? String((body as { message: unknown }).message) : 'unknown error'}`,
      );
    return body as T;
  }

  async createOrder(input: CreatePaymentOrderInput): Promise<CreatedPaymentOrder> {
    const result = await this.request<{ order_id: string; payment_session_id: string }>('/orders', {
      method: 'POST',
      body: JSON.stringify({
        order_id: input.providerOrderId,
        order_amount: Number((input.amountPaise / 100).toFixed(2)),
        order_currency: input.currency,
        customer_details: {
          customer_id: `cust_${input.customer.phone}`,
          customer_name: input.customer.name,
          customer_email: input.customer.email,
          customer_phone: input.customer.phone,
        },
        order_meta: { return_url: input.callbackUrl },
        order_note: `Order ${input.orderNumber}`,
      }),
    });
    return {
      providerOrderId: String(result.order_id ?? input.providerOrderId),
      checkout: {
        provider: 'cashfree',
        paymentSessionId: result.payment_session_id,
        orderId: String(result.order_id ?? input.providerOrderId),
        environment: this.config.get('CASHFREE_ENVIRONMENT', { infer: true }),
      },
    };
  }

  async fetchPayment(providerPaymentId: string): Promise<ProviderPaymentStatus> {
    const order = await this.request<Record<string, unknown>>(`/orders/${encodeURIComponent(providerPaymentId)}`);
    const status = String(order.order_status ?? '');
    return {
      providerPaymentId: String(order.cf_payment_id ?? providerPaymentId),
      status: status === 'PAID' ? 'PAID' : status === 'FAILED' ? 'FAILED' : 'PENDING',
      amountPaise: Math.round(Number(order.order_amount ?? 0) * 100),
      raw: order,
    };
  }

  /** Cashfree callbacks do not carry a client-side signature; the server re-queries the order. */
  verifyCallback(input: {
    providerOrderId: string;
    providerPaymentId: string;
    signature: string;
  }): boolean {
    return !!input.providerOrderId;
  }

  verifyWebhook(input: { rawBody: string; headers: Record<string, string | undefined> }): boolean {
    const { clientSecret } = this.credentials();
    const headers = Object.fromEntries(
      Object.entries(input.headers).map(([key, value]) => [key.toLowerCase(), value]),
    );
    const signature = headers['x-cf-signature'];
    const timestamp = headers['x-cf-timestamp'] ?? headers['x-webhook-timestamp'];
    if (!signature || !timestamp) return false;

    const material = `${timestamp}${input.rawBody}`;
    const candidates = [
      createHmac('sha256', clientSecret).update(material).digest('hex'),
      createHmac('sha256', clientSecret).update(material).digest('base64'),
    ];
    return candidates.some((expected) => {
      const expectedBuffer = Buffer.from(expected, 'utf8');
      const actualBuffer = Buffer.from(signature, 'utf8');
      return (
        expectedBuffer.length === actualBuffer.length &&
        timingSafeEqual(expectedBuffer, actualBuffer)
      );
    });
  }

  webhookEventId(
    payload: Record<string, unknown>,
    headers: Record<string, string | undefined>,
  ): string {
    const lowerHeaders = Object.fromEntries(
      Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
    );
    const headerId = lowerHeaders['x-cf-event-id'] ?? lowerHeaders['x-webhook-id'];
    if (headerId) return headerId;
    const data = (payload.data ?? {}) as Record<string, unknown>;
    const order = (data.order ?? {}) as Record<string, unknown>;
    return `${String(payload.type ?? payload.event ?? 'event')}:${String(order.order_id ?? 'unknown')}`;
  }

  parseWebhook(payload: Record<string, unknown>): {
    providerPaymentId?: string;
    providerOrderId?: string;
    status: 'PAID' | 'FAILED' | 'PENDING';
    eventType: string;
  } {
    const eventType = String(payload.type ?? payload.event ?? 'unknown');
    const data = (payload.data ?? {}) as Record<string, unknown>;
    const order = (data.order ?? {}) as Record<string, unknown>;
    const payment = (data.payment ?? {}) as Record<string, unknown>;
    const orderStatus = String(order.order_status ?? '');
    return {
      providerPaymentId: payment.cf_payment_id ? String(payment.cf_payment_id) : undefined,
      providerOrderId: order.order_id ? String(order.order_id) : undefined,
      status: orderStatus === 'PAID' ? 'PAID' : orderStatus === 'FAILED' ? 'FAILED' : 'PENDING',
      eventType,
    };
  }

  async createRefund(input: CreateRefundInput): Promise<CreatedRefund> {
    const result = await this.request<Record<string, unknown>>(`/orders/${encodeURIComponent(input.providerPaymentId)}/refunds`, {
      method: 'POST',
      body: JSON.stringify({
        refund_amount: Number((input.amountPaise / 100).toFixed(2)),
        refund_reason: input.reason,
        refund_id: input.refundId,
      }),
    });
    const status = String(result.refund_status ?? 'PENDING');
    return {
      providerRefundId: String(result.cf_refund_id ?? input.refundId),
      status:
        status === 'SUCCESS' ? 'COMPLETED' : status === 'FAILED' ? 'FAILED' : 'PROCESSING',
    };
  }
}
