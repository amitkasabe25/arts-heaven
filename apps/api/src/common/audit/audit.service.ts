import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AuthUser } from '../decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditInput {
  action: string;
  entityType: string;
  entityId?: string;
  changes?: Record<string, unknown>;
  actor?: AuthUser | null;
  request?: Request;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: input.actor?.id,
        actorRole: input.actor?.roles[0] ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        changes: (input.changes ?? {}) as object,
        ipAddress: input.request?.ip,
        userAgent: input.request?.headers['user-agent'],
      },
    });
  }
}
