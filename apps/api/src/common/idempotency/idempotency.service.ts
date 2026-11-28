import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Claims a key atomically. A second request with the same key and a different
   * payload is rejected; a replay of the identical request receives the stored result.
   */
  async claim(
    key: string,
    scope: string,
    fingerprint: string,
    ttlMinutes = 60,
  ): Promise<{ replay: boolean; result?: unknown }> {
    try {
      await this.prisma.idempotencyRecord.create({
        data: {
          key: `${scope}:${key}`,
          scope,
          fingerprint,
          expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
        },
      });
      return { replay: false };
    } catch {
      const existing = await this.prisma.idempotencyRecord.findUnique({
        where: { key: `${scope}:${key}` },
      });
      if (!existing || existing.fingerprint !== fingerprint || existing.expiresAt < new Date()) {
        throw new ConflictException('Idempotency key was already used for a different request');
      }
      return { replay: true, result: existing.result };
    }
  }

  async complete(key: string, scope: string, result: unknown): Promise<void> {
    await this.prisma.idempotencyRecord.update({
      where: { key: `${scope}:${key}` },
      data: { result: result as object },
    });
  }

  async release(key: string, scope: string): Promise<void> {
    await this.prisma.idempotencyRecord.deleteMany({ where: { key: `${scope}:${key}` } });
  }
}
