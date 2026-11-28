import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { slugify } from '../common/utils/slug.util';
import {
  CreateCategoryDto,
  ReorderCategoriesDto,
  UpdateCategoryDto,
} from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public catalogue: only visible, non-deleted categories with live product counts. */
  async listPublic() {
    const categories = await this.prisma.category.findMany({
      where: { deletedAt: null, isVisible: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: {
        children: {
          where: { deletedAt: null, isVisible: true },
          orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        },
      },
    });
    const counts = await this.liveProductCounts();
    const withCount = (category: { id: string }) => ({
      ...category,
      productCount: counts.get(category.id) ?? 0,
    });
    return categories.map((category) => ({
      ...withCount(category),
      children: category.children.map(withCount),
    }));
  }

  /** Admin catalogue: includes hidden categories, paginated. */
  async listAdmin(params: { skip: number; take: number; search?: string }) {
    const where: Prisma.CategoryWhereInput = {
      deletedAt: null,
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { slug: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.category.count({ where }),
    ]);
    const counts = await this.liveProductCounts();
    return {
      items: items.map((category) => ({ ...category, productCount: counts.get(category.id) ?? 0 })),
      total,
    };
  }

  async findBySlug(slug: string) {
    const category = await this.prisma.category.findFirst({
      where: { slug, deletedAt: null, isVisible: true },
      include: {
        children: {
          where: { deletedAt: null, isVisible: true },
          orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        },
      },
    });
    if (!category) throw new NotFoundException('Category not found');
    const counts = await this.liveProductCounts([category.id, ...category.children.map((c) => c.id)]);
    return {
      ...category,
      productCount: counts.get(category.id) ?? 0,
      children: category.children.map((child) => ({
        ...child,
        productCount: counts.get(child.id) ?? 0,
      })),
    };
  }

  async create(dto: CreateCategoryDto) {
    if (dto.parentId) await this.ensureParent(dto.parentId);
    const slug = await this.uniqueSlug(dto.slug ?? dto.name, 'category');

    return this.prisma.category.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description,
        tagline: dto.tagline,
        thumbnail: dto.thumbnail,
        bannerImage: dto.bannerImage,
        seoTitle: dto.seoTitle,
        seoDescription: dto.seoDescription,
        displayOrder: dto.displayOrder ?? 0,
        isVisible: dto.isVisible ?? true,
        parentId: dto.parentId ?? null,
      },
    });
  }

  async update(slug: string, dto: UpdateCategoryDto) {
    const category = await this.findBySlugOrThrow(slug);
    if (dto.parentId) {
      if (dto.parentId === category.id) throw new BadRequestException('A category cannot be its own parent');
      await this.ensureParent(dto.parentId);
    }

    const nextSlug =
      dto.slug && slugify(dto.slug) !== slug
        ? await this.uniqueSlug(dto.slug, 'category', category.id)
        : undefined;

    return this.prisma.category.update({
      where: { id: category.id },
      data: {
        name: dto.name?.trim(),
        slug: nextSlug,
        description: dto.description,
        tagline: dto.tagline,
        thumbnail: dto.thumbnail,
        bannerImage: dto.bannerImage,
        seoTitle: dto.seoTitle,
        seoDescription: dto.seoDescription,
        displayOrder: dto.displayOrder,
        isVisible: dto.isVisible,
        parentId: dto.parentId === undefined ? undefined : dto.parentId,
      },
    });
  }

  /**
   * Soft delete. Categories that still have products are protected, and child
   * categories are re-parented so they do not silently disappear.
   */
  async remove(slug: string): Promise<void> {
    const category = await this.findBySlugOrThrow(slug);
    const productCount = await this.prisma.product.count({ where: { categoryId: category.id } });
    if (productCount > 0) {
      throw new BadRequestException(
        'This category still has products. Move or delete them before removing the category.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.category.updateMany({
        where: { parentId: category.id, deletedAt: null },
        data: { parentId: category.parentId },
      }),
      this.prisma.category.update({
        where: { id: category.id },
        data: { deletedAt: new Date(), isVisible: false },
      }),
    ]);
  }

  async reorder(dto: ReorderCategoriesDto): Promise<void> {
    const ids = dto.items.map((item) => item.id);
    const existing = await this.prisma.category.count({ where: { id: { in: ids }, deletedAt: null } });
    if (existing !== new Set(ids).size) throw new NotFoundException('One or more categories were not found');

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.category.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        }),
      ),
    );
  }

  private async findBySlugOrThrow(slug: string) {
    const category = await this.prisma.category.findFirst({
      where: { slug, deletedAt: null },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  private async ensureParent(parentId: string): Promise<void> {
    const parent = await this.prisma.category.findFirst({
      where: { id: parentId, deletedAt: null },
      select: { id: true },
    });
    if (!parent) throw new BadRequestException('Parent category not found');
  }

  private async uniqueSlug(input: string, fallback: string, excludeId?: string): Promise<string> {
    const root = slugify(input) || fallback;
    let candidate = root;
    for (let suffix = 2; suffix < 100; suffix += 1) {
      // eslint-disable-next-line no-await-in-loop
      const existing = await this.prisma.category.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!existing || existing.id === excludeId) return candidate;
      candidate = `${root}-${suffix}`;
    }
    throw new ConflictException('Could not generate a unique category slug');
  }

  private async liveProductCounts(categoryIds?: string[]): Promise<Map<string, number>> {
    const grouped = await this.prisma.product.groupBy({
      by: ['categoryId'],
      where: {
        deletedAt: null,
        status: ProductStatus.ACTIVE,
        ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
      },
      _count: { _all: true },
    });
    return new Map(grouped.map((row) => [row.categoryId, row._count._all]));
  }
}
