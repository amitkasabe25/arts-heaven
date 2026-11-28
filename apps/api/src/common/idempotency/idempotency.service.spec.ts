import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IdempotencyService } from './idempotency.service';

describe('IdempotencyService', () => {
  let record: Record<string, unknown> | null;
  let prisma: {
    idempotencyRecord: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      deleteMany: jest.Mock;
    };
  };
  let service: IdempotencyService;

  beforeEach(() => {
    record = null;
    prisma = {
      idempotencyRecord: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          if (record) throw new Error('unique violation');
          record = { ...data };
          return record;
        }),
        findUnique: jest.fn(async () => record),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          record = { ...record, ...data };
          return record;
        }),
        deleteMany: jest.fn(async () => {
          record = null;
          return { count: 1 };
        }),
      },
    };
    service = new IdempotencyService(prisma as unknown as PrismaService);
  });

  it('claims a new key exactly once', async () => {
    await expect(service.claim('key-1', 'checkout', '{}')).resolves.toEqual({ replay: false });
  });

  it('replays the stored result for an identical request', async () => {
    await service.claim('key-1', 'checkout', '{}');
    await service.complete('key-1', 'checkout', { orderId: 'o1' });
    await expect(service.claim('key-1', 'checkout', '{}')).resolves.toEqual({
      replay: true,
      result: { orderId: 'o1' },
    });
  });

  it('rejects a reused key with a different payload', async () => {
    await service.claim('key-1', 'checkout', '{"amount":100}');
    await expect(service.claim('key-1', 'checkout', '{"amount":200}')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('releases a key after a failed operation so it can be retried', async () => {
    await service.claim('key-1', 'checkout', '{}');
    await service.release('key-1', 'checkout');
    await expect(service.claim('key-1', 'checkout', '{}')).resolves.toEqual({ replay: false });
  });
});
