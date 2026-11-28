import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../common/audit/audit.service';
import { skipTake } from '../common/pagination/pagination.dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { ListAuditLogsQueryDto } from './dto/audit-log.dto';

/**
 * Read-only companion to the shared AuditService. It extends rather than
 * duplicates the shared service so `record()` stays defined in one place.
 */
@Injectable()
export class AuditLogsService extends AuditService {
  constructor(private readonly prismaClient: PrismaService) {
    super(prismaClient);
  }

  async list(query: ListAuditLogsQueryDto) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (query.from) createdAt.gte = new Date(query.from);
    if (query.to) createdAt.lte = new Date(query.to);

    const where: Prisma.AuditLogWhereInput = {
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.action
        ? { action: { contains: query.action, mode: 'insensitive' as const } }
        : {}),
      ...(query.entityType
        ? { entityType: { contains: query.entityType, mode: 'insensitive' as const } }
        : {}),
      ...(Object.keys(createdAt).length > 0 ? { createdAt } : {}),
    };

    const { skip, take } = skipTake(query.page, query.limit);
    const [items, total] = await this.prismaClient.$transaction([
      this.prismaClient.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: query.order === 'asc' ? 'asc' : 'desc' },
        include: { actor: { select: { id: true, name: true, email: true } } },
      }),
      this.prismaClient.auditLog.count({ where }),
    ]);
    return { items, total };
  }
}
