import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationQueryDto, skipTake } from '../common/pagination/pagination.dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateStoreSettingDto, UpdateStoreSettingDto } from './dto/store-setting.dto';

@Injectable()
export class StoreSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PaginationQueryDto) {
    const { skip, take } = skipTake(query.page, query.limit);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.storeSetting.findMany({
        skip,
        take,
        orderBy: { key: query.order === 'asc' ? 'asc' : 'desc' },
      }),
      this.prisma.storeSetting.count(),
    ]);
    return { items, total };
  }

  async findByKey(key: string) {
    const setting = await this.prisma.storeSetting.findUnique({ where: { key } });
    if (!setting) throw new NotFoundException('Store setting not found');
    return setting;
  }

  async create(dto: CreateStoreSettingDto) {
    if (await this.prisma.storeSetting.findUnique({ where: { key: dto.key } }))
      throw new ConflictException('Store setting already exists');

    return this.prisma.storeSetting.create({
      data: {
        key: dto.key,
        value: dto.value as Prisma.InputJsonValue,
        description: dto.description,
      },
    });
  }

  async update(key: string, dto: UpdateStoreSettingDto) {
    await this.findByKey(key);
    return this.prisma.storeSetting.update({
      where: { key },
      data: {
        ...(dto.value !== undefined ? { value: dto.value as Prisma.InputJsonValue } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
      },
    });
  }

  async remove(key: string): Promise<void> {
    await this.findByKey(key);
    await this.prisma.storeSetting.delete({ where: { key } });
  }

  /** Only keys explicitly marked as public are exposed to guests. */
  async listPublic(): Promise<Record<string, unknown>> {
    const settings = await this.prisma.storeSetting.findMany({
      where: { key: { startsWith: 'public.' } },
      orderBy: { key: 'asc' },
      select: { key: true, value: true },
    });
    return Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));
  }
}
