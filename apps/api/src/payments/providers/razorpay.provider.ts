import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import Razorpay from 'razorpay';
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
export class RazorpayProvider implements PaymentProviderAdapter {
  readonly name = PaymentProvider.RAZORPAY;
  private readonly logger = new Logger(RazorpayProvider.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  private get keyId(): string {
    return this.config.get('RAZORPAY_KEY_ID', { infer: true });
  }

  private client(): Razorpay {
    const keyId = this.keyId;
    const keySecret = this.config.get('RAZORPAY_KEY_SECRET', { infer: true });
    if (!keyId || !keySecret)
      throw new ServiceUnavailableException('Razorpay is not configured on this server');
    return new Razorpay({ key_id: keyId, key_secret: keySecret });
  }

  async createOrder(input: CreatePaymentOrderInput): Promise<CreatedPaymentOrder> {
    const order = await this.client().orders.create({
      amount: input.amountPaise,
      currency: input.currency,
      receipt: input.providerOrderId,
      notes: { orderNumber: input.orderNumber },
    });
    return {
      providerOrderId: String(order.id),
      checkout: {
        provider: 'razorpay',
        keyId: this.keyId,
        orderId: String(order.id),
        amount: input.amountPaise,
        currency: input.currency,
        name: 'Artsheaven',
        description: `Order ${input.orderNumber}`,
        prefill: {
          name: input.customer.name,
          email: input.customer.email,
          contact: input.customer.phone,
        },
        callbackUrl: input.callbackUrl,
      },
    };
  }

  async fetchPayment(providerPaymentId: string): Promise<ProviderPaymentStatus> {
    const payment = (await this.client().payments.fetch(providerPaymentId)) as unknown as Record<string, unknown>;
    const status = String(payment.status ?? '');
    return {
      providerPaymentId: String(payment.id ?? providerPaymentId),
      status: status === 'captured' || status === 'authorized' ? 'PAID' : status === 'failed' ? 'FAILED' : 'PENDING',
      amountPaise: Number(payment.amount ?? 0),
      method: payment.method ? String(payment.method) : undefined,
      raw: payment,
    };
  }

  verifyCallback(input: {
    providerOrderId: string;
    providerPaymentId: string;
    signature: string;
  }): boolean {
    const secret = this.config.get('RAZORPAY_KEY_SECRET', { infer: true });
    if (!secret) return false;
    return this.safeEqual(
      `${input.providerOrderId}|${input.providerPaymentId}`,
      input.signature,
      secret,
    );
  }

  verifyWebhook(input: { rawBody: string; headers: Record<string, string | undefined> }): boolean {
    const secret = this.config.get('RAZORPAY_WEBHOOK_SECRET', { infer: true });
    const signature = input.headers['x-razorpay-signature'];
    if (!secret || !signature) return false;
    return this.safeEqual(input.rawBody, signature, secret);
  }

  webhookEventId(payload: Record<string, unknown>, headers: Record<string, string | undefined>): string {
    const headerId = headers['x-razorpay-event-id'];
    if (headerId) return headerId;
    const payment = (payload.payload as Record<string, unknown> | undefined)?.payment as
      | Record<string, unknown>
      | undefined;
    const entity = payment?.entity as Record<string, unknown> | undefined;
    return `${String(payload.event ?? 'event')}:${String(entity?.id ?? 'unknown')}`;
  }

  parseWebhook(payload: Record<string, unknown>): {
    providerPaymentId?: string;
    providerOrderId?: string;
    status: 'PAID' | 'FAILED' | 'PENDING';
    eventType: string;
  } {
    const eventType = String(payload.event ?? 'unknown');
    const body = (payload.payload ?? {}) as Record<string, unknown>;
    const payment = (body.payment ?? {}) as Record<string, unknown>;
    const order = (body.order ?? {}) as Record<string, unknown>;
    const paymentEntity = (payment.entity ?? {}) as Record<string, unknown>;
    const orderEntity = (order.entity ?? {}) as Record<string, unknown>;
    return {
      providerPaymentId: paymentEntity.id ? String(paymentEntity.id) : undefined,
      providerOrderId:
        (orderEntity.id ? String(orderEntity.id) : undefined) ??
        (paymentEntity.order_id ? String(paymentEntity.order_id) : undefined),
      status: eventType.includes('failed')
        ? 'FAILED'
        : eventType.includes('captured') || eventType.includes('authorized')
          ? 'PAID'
          : 'PENDING',
      eventType,
    };
  }

  async createRefund(input: CreateRefundInput): Promise<CreatedRefund> {
    const refund = (await this.client().payments.refund(input.providerPaymentId, {
      amount: input.amountPaise,
      notes: { reason: input.reason, refundId: input.refundId },
    })) as unknown as Record<string, unknown>;
    const status = String(refund.status ?? 'pending');
    return {
      providerRefundId: String(refund.id ?? input.refundId),
      status: status === 'processed' ? 'COMPLETED' : status === 'failed' ? 'FAILED' : 'PENDING',
    };
  }

  private safeEqual(payload: string, signature: string, secret: string): boolean {
    try {
      const expected = createHmac('sha256', secret).update(payload).digest('hex');
      const expectedBuffer = Buffer.from(expected, 'utf8');
      const actualBuffer = Buffer.from(signature, 'utf8');
      return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
    } catch (error) {
      this.logger.warn(`Signature comparison failed: ${(error as Error).message}`);
      return false;
    }
  }
}
