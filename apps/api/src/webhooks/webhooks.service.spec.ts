import { UnauthorizedException } from '@nestjs/common';
import { PaymentProvider, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { decimal } from '../common/utils/money.util';
import { PaymentProviderFactory } from '../payments/providers/provider.factory';
import { PaymentsService } from '../payments/payments.service';
import { WebhooksService } from './webhooks.service';

const payment = {
  id: 'pay_1',
  amount: decimal(500),
  status: PaymentStatus.PENDING,
  provider: PaymentProvider.RAZORPAY,
  providerOrderId: 'order_1',
  providerPaymentId: null,
};

describe('WebhooksService', () => {
  let prisma: {
    paymentWebhookEvent: { create: jest.Mock; update: jest.Mock };
  };
  let adapter: {
    verifyWebhook: jest.Mock;
    webhookEventId: jest.Mock;
    parseWebhook: jest.Mock;
    fetchPayment: jest.Mock;
  };
  let payments: { findByProviderPayment: jest.Mock; findByProviderOrder: jest.Mock; settle: jest.Mock; markFailed: jest.Mock };
  let service: WebhooksService;

  beforeEach(() => {
    let seen = false;
    prisma = {
      paymentWebhookEvent: {
        create: jest.fn(async () => {
          if (seen) throw new Error('unique violation');
          seen = true;
          return { id: 'event_1' };
        }),
        update: jest.fn(async () => ({})),
      },
    };
    adapter = {
      verifyWebhook: jest.fn().mockReturnValue(true),
      webhookEventId: jest.fn().mockReturnValue('evt_1'),
      parseWebhook: jest.fn().mockReturnValue({
        providerPaymentId: 'rzp_pay_1',
        providerOrderId: 'order_1',
        status: 'PAID',
        eventType: 'payment.captured',
      }),
      fetchPayment: jest.fn().mockResolvedValue({
        providerPaymentId: 'rzp_pay_1',
        status: 'PAID',
        amountPaise: 50000,
        method: 'card',
      }),
    };
    payments = {
      findByProviderPayment: jest.fn().mockResolvedValue(payment),
      findByProviderOrder: jest.fn().mockResolvedValue(payment),
      settle: jest.fn().mockResolvedValue({}),
      markFailed: jest.fn().mockResolvedValue(undefined),
    };
    const factory = { get: jest.fn().mockReturnValue(adapter) } as unknown as PaymentProviderFactory;
    service = new WebhooksService(
      prisma as unknown as PrismaService,
      factory,
      payments as unknown as PaymentsService,
    );
  });

  it('rejects webhooks with an invalid signature before touching the database', async () => {
    adapter.verifyWebhook.mockReturnValue(false);
    await expect(
      service.handle(PaymentProvider.RAZORPAY, '{}', {}, {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.paymentWebhookEvent.create).not.toHaveBeenCalled();
  });

  it('settles a verified payment only when the amount matches', async () => {
    const result = await service.handle(PaymentProvider.RAZORPAY, '{}', {}, {});
    expect(result).toEqual({ received: true, processed: true });
    expect(payments.settle).toHaveBeenCalledWith('pay_1', 'rzp_pay_1', 'card');

    adapter.fetchPayment.mockResolvedValue({
      providerPaymentId: 'rzp_pay_1',
      status: 'PAID',
      amountPaise: 10000,
    });
    await service.handle(PaymentProvider.RAZORPAY, '{}', {}, {});
    expect(payments.settle).toHaveBeenCalledTimes(1);
  });

  it('ignores duplicate webhook deliveries', async () => {
    await service.handle(PaymentProvider.RAZORPAY, '{}', {}, {});
    const result = await service.handle(PaymentProvider.RAZORPAY, '{}', {}, {});
    expect(result).toEqual({ received: true, duplicate: true });
    expect(payments.settle).toHaveBeenCalledTimes(1);
  });
});
