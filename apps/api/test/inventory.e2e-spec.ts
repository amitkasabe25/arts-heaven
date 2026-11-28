import { INestApplication } from '@nestjs/common';
import { PaymentProvider, ReservationStatus, RoleName, StockMovement } from '@prisma/client';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { InventoryService } from '../src/inventory/inventory.service';
import {
  API_PREFIX,
  api,
  authHeader,
  createTestApp,
  createUser,
  guestHeader,
  login,
  resetDatabase,
  seedCatalog,
  seedRolesAndPermissions,
} from './utils';

/** DB-backed e2e. Requires PostgreSQL + Redis (see test/env.ts). */
describe('Inventory consistency (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let inventory: InventoryService;
  let catalog: Awaited<ReturnType<typeof seedCatalog>>;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    inventory = app.get(InventoryService);
    await resetDatabase(prisma);
    await seedRolesAndPermissions(prisma);
    catalog = await seedCatalog(prisma);
    await createUser(prisma, {
      email: 'inventory.manager@artsheaven.local',
      roles: [RoleName.INVENTORY_MANAGER],
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('adjusts stock with an audit trail and rejects negative results', async () => {
    const token = (await login(app, 'inventory.manager@artsheaven.local')).accessToken;
    const adjusted = await api(app)
      .post(`${API_PREFIX}/admin/inventory/${catalog.productInventory.id}/adjust`)
      .set(...authHeader(token))
      .send({ delta: 5, reason: 'stock received' })
      .expect(201);
    expect(adjusted.body.data.quantity).toBe(25);

    const tx = await prisma.inventoryTransaction.findFirst({
      where: {
        inventoryId: catalog.productInventory.id,
        movement: StockMovement.ADJUSTMENT,
      },
    });
    expect(tx?.quantity).toBe(5);

    const audit = await prisma.auditLog.findFirst({ where: { action: 'inventory.adjust' } });
    expect(audit).not.toBeNull();

    await api(app)
      .post(`${API_PREFIX}/admin/inventory/${catalog.productInventory.id}/adjust`)
      .set(...authHeader(token))
      .send({ delta: -100, reason: 'oversell attempt' })
      .expect(409);
  });

  it('prevents overselling and restores availability after a confirmed sale', async () => {
    const guestA = 'e2e-inventory-guest-a';
    const guestB = 'e2e-inventory-guest-b';
    await api(app)
      .post(`${API_PREFIX}/cart/items`)
      .set(...guestHeader(guestA))
      .send({ productId: catalog.product.id, quantity: 18 })
      .expect(201);
    await api(app)
      .post(`${API_PREFIX}/checkout/place`)
      .set(...guestHeader(guestA))
      .send({
        pincode: '110001',
        recipientName: 'Stock Buyer A',
        recipientPhone: '9876543210',
        addressLine: '1 First Street',
        city: 'New Delhi',
        customerEmail: 'stock-a.e2e@artsheaven.local',
        customerPhone: '9876543210',
        paymentProvider: PaymentProvider.COD,
      })
      .expect(201);

    const afterSale = await prisma.inventory.findUniqueOrThrow({
      where: { id: catalog.productInventory.id },
    });
    expect(afterSale.quantity).toBe(7);
    expect(afterSale.reserved).toBe(0);
    const product = await prisma.product.findUniqueOrThrow({ where: { id: catalog.product.id } });
    expect(product.stockQty).toBe(7);

    const rejected = await api(app)
      .post(`${API_PREFIX}/cart/items`)
      .set(...guestHeader(guestB))
      .send({ productId: catalog.product.id, quantity: 10 })
      .expect(400);
    expect(rejected.body.success).toBe(false);

    await api(app)
      .post(`${API_PREFIX}/cart/items`)
      .set(...guestHeader(guestB))
      .send({ productId: catalog.product.id, quantity: 5 })
      .expect(201);
  });

  it('expires stale reservations without losing stock', async () => {
    const reservation = await prisma.stockReservation.create({
      data: {
        inventoryId: catalog.productInventory.id,
        quantity: 2,
        expiresAt: new Date(Date.now() - 60_000),
      },
    });
    await prisma.inventory.update({
      where: { id: catalog.productInventory.id },
      data: { reserved: { increment: 2 } },
    });

    const expiredCount = await inventory.expireReservations();
    expect(expiredCount).toBeGreaterThanOrEqual(1);
    const updated = await prisma.stockReservation.findUniqueOrThrow({ where: { id: reservation.id } });
    expect(updated.status).toBe(ReservationStatus.EXPIRED);

    const inventoryRow = await prisma.inventory.findUniqueOrThrow({
      where: { id: catalog.productInventory.id },
    });
    expect(inventoryRow.reserved).toBe(0);
    expect(inventoryRow.quantity).toBe(7);
  });
});
