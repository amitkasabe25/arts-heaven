import { INestApplication } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { PrismaService } from '../src/common/prisma/prisma.service';
import {
  API_PREFIX,
  api,
  authHeader,
  createTestApp,
  createUser,
  login,
  resetDatabase,
  seedCatalog,
  seedRolesAndPermissions,
} from './utils';

/** DB-backed e2e. Requires PostgreSQL + Redis (see test/env.ts). */
describe('Catalogue (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);
    await seedRolesAndPermissions(prisma);
    await seedCatalog(prisma);
    await createUser(prisma, {
      email: 'catalogue.admin@artsheaven.local',
      roles: [RoleName.SUPER_ADMIN],
    });
    await createUser(prisma, {
      email: 'catalogue.customer@artsheaven.local',
      roles: [RoleName.CUSTOMER],
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('lists public categories and products with pagination metadata', async () => {
    const categories = await api(app).get(`${API_PREFIX}/categories`).expect(200);
    expect(categories.body.success).toBe(true);
    expect(categories.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ slug: 'test-gifts' })]),
    );

    const products = await api(app)
      .get(`${API_PREFIX}/products`)
      .query({ search: 'Personalised', page: 1, limit: 10 })
      .expect(200);
    expect(products.body.data).toHaveLength(1);
    expect(products.body.data[0]).toMatchObject({ slug: 'test-personalised-mug' });
    expect(products.body.meta).toMatchObject({ page: 1, limit: 10, total: 1 });
  });

  it('returns a product detail with images, variants and pricing', async () => {
    const detail = await api(app)
      .get(`${API_PREFIX}/products/test-personalised-mug`)
      .expect(200);
    expect(detail.body.data.name).toBe('Test Personalised Mug');
    expect(detail.body.data.images).toHaveLength(1);
    expect(detail.body.data.variants).toHaveLength(1);
    expect(Number(detail.body.data.sellingPrice)).toBe(500);
  });

  it('denies anonymous and customer catalogue writes, allows administrators', async () => {
    const payload = { name: 'E2E New Category' };
    await api(app).post(`${API_PREFIX}/categories`).send(payload).expect(401);

    const customer = await login(app, 'catalogue.customer@artsheaven.local');
    await api(app)
      .post(`${API_PREFIX}/categories`)
      .set(...authHeader(customer.accessToken))
      .send(payload)
      .expect(403);

    const admin = await login(app, 'catalogue.admin@artsheaven.local');
    const created = await api(app)
      .post(`${API_PREFIX}/categories`)
      .set(...authHeader(admin.accessToken))
      .send(payload)
      .expect(201);
    expect(created.body.data).toMatchObject({ name: 'E2E New Category', slug: 'e2e-new-category' });

    const persisted = await prisma.category.findUnique({ where: { slug: 'e2e-new-category' } });
    expect(persisted).not.toBeNull();
  });
});
