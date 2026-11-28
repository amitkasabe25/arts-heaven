import { INestApplication } from '@nestjs/common';
import { PaymentProvider, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../src/common/prisma/prisma.service';
import {
  API_PREFIX,
  api,
  createTestApp,
  guestHeader,
  resetDatabase,
  seedCatalog,
  seedRolesAndPermissions,
} from './utils';
import { RazorpayProvider } from '../src/payments/providers/razorpay.provider';

/**
 * DB-backed e2e. Requires PostgreSQL + Redis (see test/env.ts).
 *
 * The Razorpay HTTP adapter is replaced with a deterministic stub: this suite
 * verifies the application's state transitions, ownership checks, amount checks
 * and webhook deduplication. Real provider signatures are covered by the unit
 * suite in src/payments/providers/signature.spec.ts.
 */
describe('Payments and webhooks (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let catalog: Awaited<ReturnType<typeof seedCatalog>>;
  const guestToken = 'e2e-payment-guest-001';
  const stubState = {
    callbackValid: true,
    webhookValid: true,
    remoteStatus: 'PAID' as 'PAID' | 'FAILED' | 'PENDING',
    remoteAmountPaise: 0,
  };

  beforeAll(async () => {
    app = await createTestApp((builder) =>
      builder.overrideProvider(RazorpayProvider).useValue({
        name: PaymentProvider.RAZORPAY,
        async createOrder(input: { orderNumber: string }) {
          return {
            providerOrderId: `rzp_order_${input.orderNumber}`,
            checkout: { provider: 'razorpay', keyId: 'rzp_test_e2e' },
          };
        },
        verifyCallback: () => stubState.callbackValid,
        verifyWebhook: () => stubState.webhookValid,
        webhookEventId: (payload: Record<string, unknown>) => String(payload.id ?? 'evt'),
        parseWebhook: () => ({
          providerPaymentId: 'rzp_pay_webhook_1',
          providerOrderId: 'rzp_order_webhook_1',
          status: 'PAID',
          eventType: 'payment.captured',
        }),
        async fetchPayment() {
          return {
            providerPaymentId: 'rzp_pay_webhook_1',
            status: stubState.remoteStatus,
            amountPaise: stubState.remoteAmountPaise,
            method: 'card',
            raw: {},
          };
        },
        async createRefund() {
          return { providerRefundId: 'rzp_refund_1', status: 'COMPLETED' };
        },
      }),
    );
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);
    await seedRolesAndPermissions(prisma);
    catalog = await seedCatalog(prisma);
  });

  afterAll(async () => {
    await app?.close();
  });

  async function placeRazorpayOrder(suffix: string) {
    await api(app)
      .post(`${API_PREFIX}/cart/items`)
      .set(...guestHeader(guestToken))
      .send({ productId: catalog.product.id, quantity: 1 })
      .expect(201);
    const placed = await api(app)
      .post(`${API_PREFIX}/checkout/place`)
      .set(...guestHeader(guestToken))
      .send({
        pincode: '110001',
        recipientName: 'Payment Tester',
        recipientPhone: '9876543210',
        addressLine: '45 Verification Lane',
        city: 'New Delhi',
        customerEmail: 'payment.e2e@artsheaven.local',
        customerPhone: '9876543210',
        paymentProvider: PaymentProvider.RAZORPAY,
      })
      .expect(201);
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: placed.body.data.orderId },
    });
    return { ...placed.body.data, total: order.total.toNumber(), suffix };
  }

  it('only settles payment after server verification and amount matching', async () => {
    const order = await placeRazorpayOrder('verify');
    const created = await api(app)
      .post(`${API_PREFIX}/payments/create`)
      .set(...guestHeader(guestToken))
      .send({ orderNumber: order.orderNumber, provider: PaymentProvider.RAZORPAY })
      .expect(201);
    const providerOrderId = created.body.data.providerOrderId as string;
    expect(providerOrderId).toBe(`rzp_order_${order.orderNumber}`);

    stubState.remoteAmountPaise = Math.round(order.total * 100);
    const verified = await api(app)
      .post(`${API_PREFIX}/payments/verify`)
      .set(...guestHeader(guestToken))
      .send({
        provider: PaymentProvider.RAZORPAY,
        providerOrderId,
        providerPaymentId: 'rzp_pay_verify_1',
        signature: 'valid-signature',
      })
      .expect(201);
    expect(verified.body.data.status).toBe(PaymentStatus.PAID);

    const persistedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.orderId } });
    expect(persistedOrder.status).toBe('CONFIRMED');

    const repeat = await api(app)
      .post(`${API_PREFIX}/payments/verify`)
      .set(...guestHeader(guestToken))
      .send({
        provider: PaymentProvider.RAZORPAY,
        providerOrderId,
        providerPaymentId: 'rzp_pay_verify_1',
        signature: 'valid-signature',
      })
      .expect(201);
    expect(repeat.body.data.paymentId).toBe(verified.body.data.paymentId);
  });

  it('rejects a forged callback and a mismatched provider amount', async () => {
    const order = await placeRazorpayOrder('tamper');
    await api(app)
      .post(`${API_PREFIX}/payments/create`)
      .set(...guestHeader(guestToken))
      .send({ orderNumber: order.orderNumber, provider: PaymentProvider.RAZORPAY })
      .expect(201);
    const providerOrderId = `rzp_order_${order.orderNumber}`;

    stubState.callbackValid = false;
    await api(app)
      .post(`${API_PREFIX}/payments/verify`)
      .set(...guestHeader(guestToken))
      .send({
        provider: PaymentProvider.RAZORPAY,
        providerOrderId,
        providerPaymentId: 'rzp_pay_tamper_1',
        signature: 'forged',
      })
      .expect(400);
    stubState.callbackValid = true;

    stubState.remoteAmountPaise = 100;
    await api(app)
      .post(`${API_PREFIX}/payments/verify`)
      .set(...guestHeader(guestToken))
      .send({
        provider: PaymentProvider.RAZORPAY,
        providerOrderId,
        providerPaymentId: 'rzp_pay_tamper_1',
        signature: 'valid-signature',
      })
      .expect(400);
    const payment = await prisma.payment.findFirstOrThrow({ where: { providerOrderId } });
    expect(payment.status).toBe(PaymentStatus.PENDING);
  });

  it('rejects bad webhook signatures and processes each event only once', async () => {
    const orderNumber = `AH-E2E-WEBHOOK-${Date.now()}`;
    const order = await prisma.order.create({
      data: {
        orderNumber,
        status: 'PAYMENT_PENDING',
        guestToken,
        customerSnapshot: { name: 'Webhook Tester' },
        addressSnapshot: { city: 'New Delhi' },
        subtotal: 500,
        total: 500,
        paymentProvider: PaymentProvider.RAZORPAY,
      },
    });
    await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: PaymentProvider.RAZORPAY,
        amount: 500,
        providerOrderId: 'rzp_order_webhook_1',
        status: PaymentStatus.PENDING,
        attempts: 1,
      },
    });
    stubState.remoteAmountPaise = 50000;

    stubState.webhookValid = false;
    await api(app)
      .post(`${API_PREFIX}/webhooks/razorpay`)
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', 'bad')
      .send({ id: 'evt_e2e_webhook_1', event: 'payment.captured' })
      .expect(401);
    stubState.webhookValid = true;

    const first = await api(app)
      .post(`${API_PREFIX}/webhooks/razorpay`)
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', 'valid')
      .send({ id: 'evt_e2e_webhook_1', event: 'payment.captured' })
      .expect(200);
    expect(first.body.data).toMatchObject({ received: true, processed: true });

    const duplicate = await api(app)
      .post(`${API_PREFIX}/webhooks/razorpay`)
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', 'valid')
      .send({ id: 'evt_e2e_webhook_1', event: 'payment.captured' })
      .expect(200);
    expect(duplicate.body.data).toMatchObject({ received: true, duplicate: true });

    const settled = await prisma.payment.findFirstOrThrow({
      where: { providerOrderId: 'rzp_order_webhook_1' },
    });
    expect(settled.status).toBe(PaymentStatus.PAID);
  });
});
