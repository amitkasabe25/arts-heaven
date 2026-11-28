import { Injectable } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { PERMISSION_KEYS, ROLE_PERMISSIONS } from './roles.constants';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Idempotent: safe to run on every boot and in seeders. */
  async ensureSeeded(): Promise<void> {
    for (const key of PERMISSION_KEYS) {
      await this.prisma.permission.upsert({
        where: { key },
        create: { key, description: key.replace('.', ' ') },
        update: {},
      });
    }
    for (const name of Object.values(RoleName)) {
      const role = await this.prisma.role.upsert({
        where: { name },
        create: { name, displayName: name.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()) },
        update: {},
      });
      const permissions = ROLE_PERMISSIONS[name];
      const current = await this.prisma.role.findUniqueOrThrow({
        where: { id: role.id },
        select: { permissions: { select: { key: true } } },
      });
      if (current.permissions.length !== permissions.length) {
        await this.prisma.role.update({
          where: { id: role.id },
          data: { permissions: { set: permissions.map((key) => ({ key })) } },
        });
      }
    }
  }

  list() {
    return this.prisma.role.findMany({
      include: { permissions: { select: { key: true } } },
      orderBy: { name: 'asc' },
    });
  }

  listPermissions() {
    return this.prisma.permission.findMany({ orderBy: { key: 'asc' } });
  }
}
