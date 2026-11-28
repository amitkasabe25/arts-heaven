import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationQueryDto, skipTake } from '../common/pagination/pagination.dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateBannerDto, ListBannersQueryDto, UpdateBannerDto } from './dto/banner.dto';

@Injectable()
export class BannersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListBannersQueryDto) {
    const where: Prisma.HomepageBannerWhereInput =
      query.isActive === undefined ? {} : { isActive: query.isActive };
    const { skip, take } = skipTake(query.page, query.limit);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.homepageBanner.findMany({
        where,
        skip,
        take,
        orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.homepageBanner.count({ where }),
    ]);
    return { items, total };
  }

  async listActive(query: PaginationQueryDto) {
    const where: Prisma.HomepageBannerWhereInput = { isActive: true };
    const { skip, take } = skipTake(query.page, query.limit);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.homepageBanner.findMany({
        where,
        skip,
        take,
        orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.homepageBanner.count({ where }),
    ]);
    return { items, total };
  }

  async findById(id: string) {
    const banner = await this.prisma.homepageBanner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner not found');
    return banner;
  }

  create(dto: CreateBannerDto) {
    return this.prisma.homepageBanner.create({ data: dto });
  }

  async update(id: string, dto: UpdateBannerDto) {
    await this.findById(id);
    return this.prisma.homepageBanner.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.prisma.homepageBanner.delete({ where: { id } });
  }
}
