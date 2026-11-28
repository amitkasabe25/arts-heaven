import { INestApplication } from '@nestjs/common';
import { PaymentProvider, RoleName } from '@prisma/client';
import { PrismaService } from '../src/common/prisma/prisma.service';
import {
  API_PREFIX,
  api,
  createTestApp,
  createUser,
  guestHeader,
  resetDatabase,
  seedCatalog,
  seedRolesAndPermissions,
} from './utils';

/** DB-backed e2e. Requires PostgreSQL + Redis (see test/env.ts). */
describe('Cart and checkout (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let catalog: Awaited<ReturnType<typeof seedCatalog>>;
  const guestToken = 'e2e-guest-cart-001';

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);
    await seedRolesAndPermissions(prisma);
    catalog = await seedCatalog(prisma);
    await createUser(prisma, {
      email: 'checkout.e2e@artsheaven.local',
      roles: [RoleName.CUSTOMER],
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('rejects cart access without a guest identity', async () => {
    const response = await api(app).get(`${API_PREFIX}/cart`).expect(400);
    expect(response.body.success).toBe(false);
  });

  it('adds, updates and removes guest cart items with server-calculated snapshots', async () => {
    const added = await api(app)
      .post(`${API_PREFIX}/cart/items`)
      .set(...guestHeader(guestToken))
      .send({ productId: catalog.product.id, variantId: catalog.variant.id, quantity: 2 })
      .expect(201);
    expect(added.body.data).toMatchObject({ quantity: 2 });
    expect(Number(added.body.data.unitPriceSnapshot)).toBe(500);

    const cart = await api(app)
      .get(`${API_PREFIX}/cart`)
      .set(...guestHeader(guestToken))
      .expect(200);
    expect(cart.body.data.count).toBe(2);
    expect(cart.body.data.subtotal).toBe(1000);
    expect(cart.body.data.items[0].productSnapshot).toMatchObject({
      productId: catalog.product.id,
      name: 'Test Personalised Mug',
    });

    const itemId = cart.body.data.items[0].id as string;
    await api(app)
      .patch(`${API_PREFIX}/cart/items/${itemId}`)
      .set(...guestHeader(guestToken))
      .send({ quantity: 1 })
      .expect(200);
    await api(app)
      .delete(`${API_PREFIX}/cart/items/${itemId}`)
      .set(...guestHeader(guestToken))
      .expect(200);
    const empty = await api(app)
      .get(`${API_PREFIX}/cart`)
      .set(...guestHeader(guestToken))
      .expect(200);
    expect(empty.body.data.count).toBe(0);
  });

  it('calculates the checkout quote on the server and ignores client price fields', async () => {
    await api(app)
      .post(`${API_PREFIX}/cart/items`)
      .set(...guestHeader(guestToken))
      .send({ productId: catalog.product.id, quantity: 1 })
      .expect(201);

    const quote = await api(app)
      .post(`${API_PREFIX}/checkout/quote`)
      .set(...guestHeader(guestToken))
      .send({
        pincode: '110001',
        couponCode: 'E2E10',
        giftWrapId: catalog.wrap.id,
        slotId: catalog.slot.id,
      })
      .expect(201);
    expect(quote.body.data).toMatchObject({
      subtotal: 500,
      discount: 50,
      deliveryFee: 49,
      giftWrapFee: 99,
      slotFee: 0,
      tax: 0,
      total: 598,
      couponCode: 'E2E10',
    });

    const tampered = await api(app)
      .post(`${API_PREFIX}/checkout/quote`)
      .set(...guestHeader(guestToken))
      .send({ pincode: '110001', subtotal: 1, total: 1 })
      .expect(400);
    expect(tampered.body.success).toBe(false);
  });

  it('places a COD order once for a repeated idempotency key and deducts stock', async () => {
    const payload = {
      pincode: '110001',
      recipientName: 'Gift Recipient',
      recipientPhone: '9876543210',
      addressLine: '12 Test Street, Near Park',
      city: 'New Delhi',
      customerEmail: 'guest.e2e@artsheaven.local',
      customerPhone: '9876543210',
      couponCode: 'E2E10',
      paymentProvider: PaymentProvider.COD,
    };
    const first = await api(app)
      .post(`${API_PREFIX}/checkout/place`)
      .set(...guestHeader(guestToken))
      .set('X-Idempotency-Key', 'e2e-checkout-key-001')
      .send(payload)
      .expect(201);
    const second = await api(app)
      .post(`${API_PREFIX}/checkout/place`)
      .set(...guestHeader(guestToken))
      .set('X-Idempotency-Key', 'e2e-checkout-key-001')
      .send(payload)
      .expect(201);
    expect(first.body.data).toEqual(second.body.data);
    expect(first.body.data.status).toBe('CONFIRMED');
    expect(first.body.data.total).toBe(598);

    const orders = await prisma.order.findMany({
      where: { idempotencyKey: 'e2e-checkout-key-001' },
      include: { items: true, reservations: true, couponUsages: true },
    });
    expect(orders).toHaveLength(1);
    expect(orders[0].items).toHaveLength(1);
    expect(orders[0].couponUsages[0].discount.toNumber()).toBe(50);
    expect(orders[0].reservations[0].status).toBe('CONFIRMED');

    const inventory = await prisma.inventory.findUniqueOrThrow({
      where: { id: catalog.productInventory.id },
    });
    expect(inventory.quantity).toBe(19);
    expect(inventory.reserved).toBe(0);

    const cart = await api(app)
      .get(`${API_PREFIX}/cart`)
      .set(...guestHeader(guestToken))
      .expect(200);
    expect(cart.body.data.count).toBe(0);
  });
});
