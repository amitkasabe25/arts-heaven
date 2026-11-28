import { PaymentProvider } from '@prisma/client';

export interface CreatePaymentOrderInput {
  orderNumber: string;
  amountPaise: number;
  currency: string;
  customer: { name: string; email: string; phone: string };
  providerOrderId: string;
  callbackUrl?: string;
}

export interface CreatedPaymentOrder {
  providerOrderId: string;
  /** Data returned to the storefront to initialise the provider checkout widget. */
  checkout: Record<string, unknown>;
}

export interface ProviderPaymentStatus {
  providerPaymentId: string;
  status: 'PAID' | 'FAILED' | 'PENDING';
  amountPaise: number;
  method?: string;
  raw: Record<string, unknown>;
}

export interface CreateRefundInput {
  providerPaymentId: string;
  amountPaise: number;
  reason: string;
  refundId: string;
}

export interface CreatedRefund {
  providerRefundId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
}

export interface PaymentProviderAdapter {
  readonly name: PaymentProvider;
  createOrder(input: CreatePaymentOrderInput): Promise<CreatedPaymentOrder>;
  fetchPayment(providerPaymentId: string): Promise<ProviderPaymentStatus>;
  verifyCallback(input: {
    providerOrderId: string;
    providerPaymentId: string;
    signature: string;
  }): boolean;
  verifyWebhook(input: { rawBody: string; headers: Record<string, string | undefined> }): boolean;
  webhookEventId(payload: Record<string, unknown>, headers: Record<string, string | undefined>): string;
  parseWebhook(payload: Record<string, unknown>): {
    providerPaymentId?: string;
    providerOrderId?: string;
    status: 'PAID' | 'FAILED' | 'PENDING';
    eventType: string;
  };
  createRefund(input: CreateRefundInput): Promise<CreatedRefund>;
}
