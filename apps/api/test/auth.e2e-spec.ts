import { INestApplication } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { PrismaService } from '../src/common/prisma/prisma.service';
import {
  API_PREFIX,
  TEST_PASSWORD,
  api,
  authHeader,
  createTestApp,
  createUser,
  login,
  resetDatabase,
  seedRolesAndPermissions,
} from './utils';

/**
 * DB-backed e2e. Requires PostgreSQL + Redis (see test/env.ts).
 * RUN: npm run test:e2e
 */
describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);
    await seedRolesAndPermissions(prisma);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('registers a customer, signs in and returns the current profile', async () => {
    const email = 'customer.e2e@artsheaven.local';
    const registered = await api(app)
      .post(`${API_PREFIX}/auth/register`)
      .send({ name: 'E2E Customer', email, phone: '9876543210', password: TEST_PASSWORD })
      .expect(201);
    expect(registered.body.success).toBe(true);
    expect(registered.body.data.email).toBe(email);

    const session = await login(app, email);
    expect(session.user.roles).toContain(RoleName.CUSTOMER);

    const me = await api(app)
      .get(`${API_PREFIX}/auth/me`)
      .set(...authHeader(session.accessToken))
      .expect(200);
    expect(me.body.data.email).toBe(email);
  });

  it('rotates refresh tokens and rejects reuse of the old token', async () => {
    const session = await login(app, 'customer.e2e@artsheaven.local');
    const rotated = await api(app)
      .post(`${API_PREFIX}/auth/refresh`)
      .send({ refreshToken: session.refreshToken })
      .expect(200);
    expect(rotated.body.data.refreshToken).not.toBe(session.refreshToken);

    await api(app)
      .post(`${API_PREFIX}/auth/refresh`)
      .send({ refreshToken: session.refreshToken })
      .expect(401);
  });

  it('rejects invalid credentials and malformed registration with the error envelope', async () => {
    const badLogin = await api(app)
      .post(`${API_PREFIX}/auth/login`)
      .send({ email: 'customer.e2e@artsheaven.local', password: 'WrongPassword123!' })
      .expect(401);
    expect(badLogin.body).toMatchObject({ success: false, data: null });

    const badRegister = await api(app)
      .post(`${API_PREFIX}/auth/register`)
      .send({ name: 'X', email: 'not-an-email', phone: '123', password: 'short' })
      .expect(400);
    expect(badRegister.body.success).toBe(false);
    expect(badRegister.body.message).toBe('Validation failed');
  });

  it('keeps administrator endpoints gated by role', async () => {
    await createUser(prisma, { email: 'admin.e2e@artsheaven.local', roles: [RoleName.SUPER_ADMIN] });
    const admin = await api(app)
      .post(`${API_PREFIX}/auth/admin/login`)
      .send({ email: 'admin.e2e@artsheaven.local', password: TEST_PASSWORD })
      .expect(200);
    await api(app)
      .get(`${API_PREFIX}/auth/staff-check`)
      .set(...authHeader(admin.body.data.accessToken))
      .expect(200);

    const customer = await login(app, 'customer.e2e@artsheaven.local');
    await api(app)
      .post(`${API_PREFIX}/auth/admin/login`)
      .send({ email: 'customer.e2e@artsheaven.local', password: TEST_PASSWORD })
      .expect(401);
    await api(app)
      .get(`${API_PREFIX}/auth/staff-check`)
      .set(...authHeader(customer.accessToken))
      .expect(403);
  });
});
