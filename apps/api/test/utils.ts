import { INestApplication } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { CouponType, PaymentProvider, Prisma, RoleName } from '@prisma/client';
import bcrypt from 'bcryptjs';
import express from 'express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PERMISSION_KEYS } from '../src/roles/roles.constants';
import { PrismaService } from '../src/common/prisma/prisma.service';

export const API_PREFIX = '/api/v1';
export const TEST_PASSWORD = 'StrongPass123!';

/** Boots the real application (guards, pipes, interceptors and all modules). */
export async function createTestApp(
  configure?: (builder: TestingModuleBuilder) => TestingModuleBuilder,
): Promise<INestApplication> {
  let builder: TestingModuleBuilder = Test.createTestingModule({ imports: [AppModule] });
  if (configure) builder = configure(builder);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication({ bodyParser: false });
  app.use(
    express.json({
      limit: '2mb',
      verify: (req, _res, buffer) => {
        (req as express.Request).rawBody = buffer.toString('utf8');
      },
    }),
  );
  app.setGlobalPrefix(API_PREFIX.replace(/^\//, ''));
  await app.init();
  return app;
}

export function api(app: INestApplication) {
  return request(app.getHttpServer());
}

/** Destructive: truncates every application table. Test databases only. */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (!rows.length) return;
  const list = rows.map((row) => `"${row.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export async function seedRolesAndPermissions(prisma: PrismaService): Promise<void> {
  await prisma.role.createMany({
    data: Object.values(RoleName).map((name) => ({
      name,
      displayName: name.replaceAll('_', ' '),
    })),
  });
  await prisma.permission.createMany({
    data: PERMISSION_KEYS.map((key) => ({ key })),
  });
  const superAdmin = await prisma.role.findUniqueOrThrow({
    where: { name: RoleName.SUPER_ADMIN },
    include: { permissions: true },
  });
  const permissions = await prisma.permission.findMany();
  await prisma.role.update({
    where: { id: superAdmin.id },
    data: { permissions: { set: permissions.map((permission) => ({ id: permission.id })) } },
  });
}

export async function createUser(
  prisma: PrismaService,
  options: { email: string; name?: string; roles?: RoleName[]; password?: string },
) {
  const passwordHash = await bcrypt.hash(options.password ?? TEST_PASSWORD, 8);
  return prisma.user.create({
    data: {
      email: options.email,
      name: options.name ?? 'Test User',
      phone: '9876543210',
      passwordHash,
      emailVerifiedAt: new Date(),
      roles: {
        connect: (options.roles ?? [RoleName.CUSTOMER]).map((name) => ({ name })),
      },
    },
  });
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: { id: string; roles: RoleName[] };
}

export async function login(
  app: INestApplication,
  email: string,
  password = TEST_PASSWORD,
): Promise<LoginResult> {
  const response = await api(app)
    .post(`${API_PREFIX}/auth/login`)
    .send({ email, password })
    .expect(200);
  expect(response.body.success).toBe(true);
  return response.body.data as LoginResult;
}

/** Creates a minimal, fully usable catalogue plus shipping and a coupon. */
export async function seedCatalog(prisma: PrismaService) {
  const category = await prisma.category.create({
    data: { name: 'Test Gifts', slug: 'test-gifts', isVisible: true },
  });
  const product = await prisma.product.create({
    data: {
      name: 'Test Personalised Mug',
      slug: 'test-personalised-mug',
      sku: 'TEST-MUG-001',
      categoryId: category.id,
      basePrice: 500,
      sellingPrice: 500,
      status: 'ACTIVE',
      productType: 'SIMPLE',
      trackStock: true,
      stockQty: 20,
    },
  });
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      name: 'Standard',
      sku: 'TEST-MUG-001-STD',
      options: { size: 'Standard' },
      price: 500,
      stockQty: 20,
    },
  });
  await prisma.productImage.create({
    data: { productId: product.id, url: '/images/test-mug.png', isPrimary: true },
  });
  const productInventory = await prisma.inventory.create({
    data: { stockKey: `p:${product.id}`, productId: product.id, quantity: 20 },
  });
  const variantInventory = await prisma.inventory.create({
    data: { stockKey: `v:${variant.id}`, variantId: variant.id, quantity: 20 },
  });
  const zone = await prisma.deliveryZone.create({
    data: { name: 'Test Metro', pincodePrefixes: ['110'], deliveryFee: 49, freeAbove: 999 },
  });
  const slot = await prisma.deliverySlot.create({
    data: { code: 'TEST_SLOT', label: 'Test slot', windowText: '10am - 6pm', fee: 0 },
  });
  const wrap = await prisma.giftWrap.create({
    data: { code: 'TEST_WRAP', name: 'Test wrap', price: 99 },
  });
  const coupon = await prisma.coupon.create({
    data: {
      code: 'E2E10',
      type: CouponType.PERCENT,
      value: 10,
      minSubtotal: 0,
      isActive: true,
    },
  });
  return { category, product, variant, productInventory, variantInventory, zone, slot, wrap, coupon };
}

export function authHeader(token: string): [string, string] {
  return ['Authorization', `Bearer ${token}`];
}

export function guestHeader(token: string): [string, string] {
  return ['X-Guest-Token', token];
}

export function paymentProviderEnum() {
  return PaymentProvider;
}

export function decimalToNumber(value: Prisma.Decimal | number | string): number {
  return Number(value);
}
