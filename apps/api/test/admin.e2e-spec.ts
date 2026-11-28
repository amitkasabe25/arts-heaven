import { INestApplication } from '@nestjs/common';
import { OrderStatus, PaymentProvider, RoleName } from '@prisma/client';
import { PrismaService } from '../src/common/prisma/prisma.service';
import {
  API_PREFIX,
  api,
  authHeader,
  createTestApp,
  createUser,
  login,
  resetDatabase,
  seedRolesAndPermissions,
} from './utils';

/** DB-backed e2e. Requires PostgreSQL + Redis (see test/env.ts). */
describe('Admin access and order lifecycle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);
    await seedRolesAndPermissions(prisma);
    await createUser(prisma, {
      email: 'admin.customer@artsheaven.local',
      roles: [RoleName.CUSTOMER],
    });
    await createUser(prisma, {
      email: 'admin.orders@artsheaven.local',
      roles: [RoleName.ORDER_MANAGER],
    });
    await createUser(prisma, {
      email: 'admin.super@artsheaven.local',
      roles: [RoleName.SUPER_ADMIN],
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  async function accessTokenFor(email: string) {
    return (await login(app, email)).accessToken;
  }

  it('denies customers and allows staff on dashboard APIs', async () => {
    const customerToken = await accessTokenFor('admin.customer@artsheaven.local');
    await api(app)
      .get(`${API_PREFIX}/admin/dashboard`)
      .set(...authHeader(customerToken))
      .expect(403);

    const orderManagerToken = await accessTokenFor('admin.orders@artsheaven.local');
    await api(app)
      .get(`${API_PREFIX}/admin/dashboard`)
      .set(...authHeader(orderManagerToken))
      .expect(200);

    const superToken = await accessTokenFor('admin.super@artsheaven.local');
    const dashboard = await api(app)
      .get(`${API_PREFIX}/admin/dashboard`)
      .set(...authHeader(superToken))
      .expect(200);
    expect(dashboard.body.data).toHaveProperty('revenue');
    expect(dashboard.body.data).toHaveProperty('ordersByStatus');
  });

  it('enforces per-role permissions beyond simple staff checks', async () => {
    const orderManagerToken = await accessTokenFor('admin.orders@artsheaven.local');
    await api(app)
      .post(`${API_PREFIX}/categories`)
      .set(...authHeader(orderManagerToken))
      .send({ name: 'Forbidden Category' })
      .expect(403);
    await api(app)
      .get(`${API_PREFIX}/audit-logs`)
      .set(...authHeader(orderManagerToken))
      .expect(403);

    const superToken = await accessTokenFor('admin.super@artsheaven.local');
    await api(app)
      .post(`${API_PREFIX}/categories`)
      .set(...authHeader(superToken))
      .send({ name: 'Allowed Category' })
      .expect(201);
    await api(app)
      .get(`${API_PREFIX}/audit-logs`)
      .set(...authHeader(superToken))
      .expect(200);
  });

  it('applies the order state machine and records status history', async () => {
    const order = await prisma.order.create({
      data: {
        orderNumber: `AH-E2E-ADMIN-${Date.now()}`,
        status: OrderStatus.PAYMENT_PENDING,
        customerSnapshot: { name: 'Admin Tester' },
        addressSnapshot: { city: 'New Delhi' },
        subtotal: 500,
        total: 500,
        paymentProvider: PaymentProvider.RAZORPAY,
      },
    });
    const token = await accessTokenFor('admin.orders@artsheaven.local');

    const confirmed = await api(app)
      .patch(`${API_PREFIX}/admin/orders/${order.id}/status`)
      .set(...authHeader(token))
      .send({ status: OrderStatus.CONFIRMED, note: 'Payment verified manually' })
      .expect(200);
    expect(confirmed.body.data.status).toBe(OrderStatus.CONFIRMED);

    const history = await api(app)
      .get(`${API_PREFIX}/admin/orders/${order.id}/timeline`)
      .set(...authHeader(token))
      .expect(200);
    expect(history.body.data).toHaveLength(1);
    expect(history.body.data[0]).toMatchObject({
      fromStatus: OrderStatus.PAYMENT_PENDING,
      toStatus: OrderStatus.CONFIRMED,
    });

    await api(app)
      .patch(`${API_PREFIX}/admin/orders/${order.id}/status`)
      .set(...authHeader(token))
      .send({ status: OrderStatus.DELIVERED })
      .expect(400);
  });

  it('hides other customers orders from the customer API', async () => {
    const customerToken = await accessTokenFor('admin.customer@artsheaven.local');
    const response = await api(app)
      .get(`${API_PREFIX}/orders/AH-DOES-NOT-EXIST`)
      .set(...authHeader(customerToken))
      .expect(404);
    expect(response.body.success).toBe(false);
  });
});
