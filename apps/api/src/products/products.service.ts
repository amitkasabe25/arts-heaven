import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductStatus, ProductType, ReviewStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { decimal } from '../common/utils/money.util';
import { slugify } from '../common/utils/slug.util';
import {
  AttributeInputDto,
  CreateProductDto,
  CreateProductImageDto,
  CreateVariantDto,
  ProductImageInputDto,
  ProductVariantInputDto,
  ReorderImagesDto,
  UpdateProductDto,
  UpdateProductImageDto,
  UpdateVariantDto,
} from './dto/product.dto';

export interface ProductListParams {
  skip: number;
  take: number;
  categorySlug?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  isFeatured?: boolean;
  isBestSeller?: boolean;
  status?: ProductStatus;
  sortBy?: 'createdAt' | 'price' | 'name';
  order: 'asc' | 'desc';
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: ProductListParams) {
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(params.status ? { status: params.status } : {}),
      ...(params.categorySlug
        ? { category: { slug: params.categorySlug, deletedAt: null, isVisible: true } }
        : {}),
      ...(params.isFeatured !== undefined ? { isFeatured: params.isFeatured } : {}),
      ...(params.isBestSeller !== undefined ? { isBestSeller: params.isBestSeller } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { sku: { contains: params.search, mode: 'insensitive' } },
              { shortDescription: { contains: params.search, mode: 'insensitive' } },
              { description: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(params.minPrice !== undefined || params.maxPrice !== undefined
        ? {
            sellingPrice: {
              ...(params.minPrice !== undefined ? { gte: decimal(params.minPrice) } : {}),
              ...(params.maxPrice !== undefined ? { lte: decimal(params.maxPrice) } : {}),
            },
          }
        : {}),
    };

    const primary =
      params.sortBy === 'price'
        ? { sellingPrice: params.order }
        : params.sortBy === 'name'
          ? { name: params.order }
          : { createdAt: params.order };
    const orderBy: Prisma.ProductOrderByWithRelationInput[] = [primary, { id: 'asc' }];

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          images: { orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }] },
          // The storefront maps these into facets, size options and tags without
          // needing one detail request per card.
          attributes: { orderBy: { position: 'asc' } },
          variants: {
            where: { deletedAt: null, isActive: true },
            orderBy: { position: 'asc' },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items, total };
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, deletedAt: null, status: ProductStatus.ACTIVE },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        images: { orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }] },
        variants: {
          where: { deletedAt: null, isActive: true },
          orderBy: { position: 'asc' },
        },
        attributes: { orderBy: { position: 'asc' } },
        customizationSchemas: {
          orderBy: { position: 'asc' },
          include: { fields: { orderBy: { position: 'asc' } } },
        },
        relatedProducts: {
          where: { deletedAt: null, status: ProductStatus.ACTIVE },
          take: 8,
          include: { images: { where: { isPrimary: true }, take: 1 } },
        },
      },
    });
    if (!product) throw new NotFoundException('Product not found');

    const approvedReviews = await this.prisma.review.count({
      where: { productId: product.id, status: ReviewStatus.APPROVED },
    });
    return { ...product, approvedReviewsCount: approvedReviews };
  }

  async create(dto: CreateProductDto) {
    await this.ensureCategory(dto.categoryId);
    if (dto.sku) await this.ensureProductSku(dto.sku);
    if (dto.relatedProductIds?.length) await this.ensureRelated(dto.relatedProductIds);
    const slug = await this.uniqueSlug(dto.slug ?? dto.name);
    const images = this.normalizeImages(dto.images ?? []);

    return this.prisma.$transaction((tx) =>
      tx.product.create({
        data: {
          name: dto.name.trim(),
          slug,
          sku: dto.sku,
          shortDescription: dto.shortDescription,
          description: dto.description,
          categoryId: dto.categoryId,
          basePrice: decimal(dto.basePrice),
          sellingPrice: decimal(dto.sellingPrice),
          compareAtPrice: dto.compareAtPrice != null ? decimal(dto.compareAtPrice) : null,
          status: dto.status ?? ProductStatus.ACTIVE,
          productType: dto.productType ?? ProductType.SIMPLE,
          isFeatured: dto.isFeatured ?? false,
          isBestSeller: dto.isBestSeller ?? false,
          trackStock: dto.trackStock ?? true,
          stockQty: dto.stockQty ?? 0,
          lowStockThreshold: dto.lowStockThreshold ?? 5,
          weightGrams: dto.weightGrams,
          ...(dto.dimensions ? { dimensions: dto.dimensions as Prisma.InputJsonValue } : {}),
          seoTitle: dto.seoTitle,
          seoDescription: dto.seoDescription,
          attributes: { create: this.attributeCreates(dto.attributes ?? []) },
          images: { create: images },
          variants: { create: this.variantCreates(dto.variants ?? []) },
          ...(dto.relatedProductIds?.length
            ? { relatedProducts: { connect: dto.relatedProductIds.map((id) => ({ id })) } }
            : {}),
        },
        include: {
          images: { orderBy: { position: 'asc' } },
          variants: { orderBy: { position: 'asc' } },
        },
      }),
    );
  }

  async update(slug: string, dto: UpdateProductDto) {
    const existing = await this.findBySlugOrThrow(slug);
    if (dto.categoryId) await this.ensureCategory(dto.categoryId);
    if (dto.sku && dto.sku !== existing.sku) await this.ensureProductSku(dto.sku, existing.id);
    if (dto.relatedProductIds) await this.ensureRelated(dto.relatedProductIds, existing.id);

    const nextSlug =
      dto.slug && slugify(dto.slug) !== existing.slug
        ? await this.uniqueSlug(dto.slug, existing.id)
        : undefined;

    return this.prisma.$transaction((tx) =>
      tx.product.update({
        where: { id: existing.id },
        data: {
          name: dto.name?.trim(),
          slug: nextSlug,
          sku: dto.sku,
          shortDescription: dto.shortDescription,
          description: dto.description,
          categoryId: dto.categoryId,
          basePrice: dto.basePrice !== undefined ? decimal(dto.basePrice) : undefined,
          sellingPrice: dto.sellingPrice !== undefined ? decimal(dto.sellingPrice) : undefined,
          compareAtPrice:
            dto.compareAtPrice === undefined
              ? undefined
              : dto.compareAtPrice === null
                ? null
                : decimal(dto.compareAtPrice),
          status: dto.status,
          productType: dto.productType,
          isFeatured: dto.isFeatured,
          isBestSeller: dto.isBestSeller,
          trackStock: dto.trackStock,
          stockQty: dto.stockQty,
          lowStockThreshold: dto.lowStockThreshold,
          weightGrams: dto.weightGrams,
          ...(dto.dimensions ? { dimensions: dto.dimensions as Prisma.InputJsonValue } : {}),
          seoTitle: dto.seoTitle,
          seoDescription: dto.seoDescription,
          ...(dto.attributes
            ? {
                attributes: {
                  deleteMany: {},
                  create: this.attributeCreates(dto.attributes),
                },
              }
            : {}),
          ...(dto.relatedProductIds
            ? {
                relatedProducts: {
                  set: dto.relatedProductIds.map((id) => ({ id })),
                },
              }
            : {}),
        },
      }),
    );
  }

  /** Soft delete: products stay in the database for order/history integrity. */
  async remove(slug: string): Promise<void> {
    const product = await this.findBySlugOrThrow(slug);
    await this.prisma.$transaction([
      this.prisma.product.update({
        where: { id: product.id },
        data: { deletedAt: new Date(), status: ProductStatus.ARCHIVED },
      }),
      this.prisma.productVariant.updateMany({
        where: { productId: product.id, deletedAt: null },
        data: { isActive: false },
      }),
    ]);
  }

  // ---------------------------------------------------------------------------
  // Variants
  // ---------------------------------------------------------------------------

  async addVariant(productId: string, dto: CreateVariantDto) {
    await this.findProductByIdOrThrow(productId);
    if (dto.sku) await this.ensureVariantSku(dto.sku);
    return this.prisma.$transaction((tx) =>
      tx.productVariant.create({
        data: { productId, ...this.variantData(dto, dto.position ?? 0) },
      }),
    );
  }

  async updateVariant(productId: string, variantId: string, dto: UpdateVariantDto) {
    await this.findProductByIdOrThrow(productId);
    const variant = await this.findVariantOrThrow(productId, variantId);
    if (dto.sku && dto.sku !== variant.sku) await this.ensureVariantSku(dto.sku, variant.id);

    return this.prisma.$transaction((tx) =>
      tx.productVariant.update({
        where: { id: variant.id },
        data: {
          name: dto.name,
          sku: dto.sku,
          options: dto.options ? (dto.options as Prisma.InputJsonValue) : undefined,
          price: dto.price !== undefined ? decimal(dto.price) : undefined,
          compareAtPrice:
            dto.compareAtPrice === undefined
              ? undefined
              : dto.compareAtPrice === null
                ? null
                : decimal(dto.compareAtPrice),
          stockQty: dto.stockQty,
          isActive: dto.isActive,
          position: dto.position,
        },
      }),
    );
  }

  async removeVariant(productId: string, variantId: string): Promise<void> {
    await this.findProductByIdOrThrow(productId);
    const variant = await this.findVariantOrThrow(productId, variantId);
    await this.prisma.$transaction([
      this.prisma.productVariant.update({
        where: { id: variant.id },
        data: { deletedAt: new Date(), isActive: false },
      }),
    ]);
  }

  // ---------------------------------------------------------------------------
  // Images
  // ---------------------------------------------------------------------------

  async addImage(productId: string, dto: CreateProductImageDto) {
    await this.findProductByIdOrThrow(productId);
    return this.prisma.$transaction(async (tx) => {
      const [imageCount, primaryCount] = await Promise.all([
        tx.productImage.count({ where: { productId } }),
        tx.productImage.count({ where: { productId, isPrimary: true } }),
      ]);
      const isPrimary = imageCount === 0 ? true : (dto.isPrimary ?? primaryCount === 0);
      if (isPrimary) {
        await tx.productImage.updateMany({ where: { productId }, data: { isPrimary: false } });
      }
      return tx.productImage.create({
        data: {
          productId,
          url: dto.url,
          alt: dto.alt,
          position: dto.position ?? imageCount,
          isPrimary,
        },
      });
    });
  }

  async updateImage(productId: string, imageId: string, dto: UpdateProductImageDto) {
    await this.findProductByIdOrThrow(productId);
    const image = await this.findImageOrThrow(productId, imageId);

    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary === true) {
        await tx.productImage.updateMany({
          where: { productId, id: { not: image.id } },
          data: { isPrimary: false },
        });
      }
      const updated = await tx.productImage.update({
        where: { id: image.id },
        data: {
          url: dto.url,
          alt: dto.alt,
          position: dto.position,
          isPrimary: dto.isPrimary,
        },
      });
      if (image.isPrimary && dto.isPrimary === false) {
        await this.promoteFirstImage(tx, productId, image.id);
      }
      return updated;
    });
  }

  async removeImage(productId: string, imageId: string): Promise<void> {
    await this.findProductByIdOrThrow(productId);
    const image = await this.findImageOrThrow(productId, imageId);
    await this.prisma.$transaction(async (tx) => {
      await tx.productImage.delete({ where: { id: image.id } });
      if (image.isPrimary) await this.promoteFirstImage(tx, productId, image.id);
    });
  }

  async reorderImages(productId: string, dto: ReorderImagesDto): Promise<void> {
    await this.findProductByIdOrThrow(productId);
    const ids = dto.items.map((item) => item.id);
    const count = await this.prisma.productImage.count({
      where: { id: { in: ids }, productId },
    });
    if (count !== new Set(ids).size) throw new NotFoundException('One or more images were not found');

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.productImage.update({
          where: { id: item.id },
          data: { position: item.position },
        }),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Related products
  // ---------------------------------------------------------------------------

  async setRelated(productId: string, productIds: string[]) {
    await this.findProductByIdOrThrow(productId);
    await this.ensureRelated(productIds, productId);
    return this.prisma.product.update({
      where: { id: productId },
      data: { relatedProducts: { set: productIds.map((id) => ({ id })) } },
      select: { id: true },
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async findBySlugOrThrow(slug: string) {
    const product = await this.prisma.product.findFirst({ where: { slug, deletedAt: null } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  private async findProductByIdOrThrow(id: string) {
    const product = await this.prisma.product.findFirst({ where: { id, deletedAt: null } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  private async findVariantOrThrow(productId: string, variantId: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId, deletedAt: null },
    });
    if (!variant) throw new NotFoundException('Product variant not found');
    return variant;
  }

  private async findImageOrThrow(productId: string, imageId: string) {
    const image = await this.prisma.productImage.findFirst({ where: { id: imageId, productId } });
    if (!image) throw new NotFoundException('Product image not found');
    return image;
  }

  private async promoteFirstImage(
    tx: Prisma.TransactionClient,
    productId: string,
    excludeId: string,
  ): Promise<void> {
    const next = await tx.productImage.findFirst({
      where: { productId, id: { not: excludeId } },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    if (next) await tx.productImage.update({ where: { id: next.id }, data: { isPrimary: true } });
  }

  private async ensureCategory(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, deletedAt: null },
      select: { id: true },
    });
    if (!category) throw new BadRequestException('Category not found');
  }

  private async ensureRelated(ids: string[], excludeId?: string): Promise<void> {
    const unique = [...new Set(ids)].filter((id) => id !== excludeId);
    if (unique.length === 0) return;
    const count = await this.prisma.product.count({ where: { id: { in: unique }, deletedAt: null } });
    if (count !== unique.length) throw new BadRequestException('One or more related products were not found');
  }

  private async ensureProductSku(sku: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.product.findUnique({ where: { sku }, select: { id: true } });
    if (existing && existing.id !== excludeId) throw new ConflictException('SKU is already in use');
  }

  private async ensureVariantSku(sku: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.productVariant.findUnique({
      where: { sku },
      select: { id: true },
    });
    if (existing && existing.id !== excludeId) throw new ConflictException('SKU is already in use');
  }

  private async uniqueSlug(input: string, excludeId?: string): Promise<string> {
    const root = slugify(input) || 'product';
    let candidate = root;
    for (let suffix = 2; suffix < 100; suffix += 1) {
      // eslint-disable-next-line no-await-in-loop
      const existing = await this.prisma.product.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!existing || existing.id === excludeId) return candidate;
      candidate = `${root}-${suffix}`;
    }
    throw new ConflictException('Could not generate a unique product slug');
  }

  private attributeCreates(attributes: AttributeInputDto[]) {
    return attributes.map((attribute, index) => ({
      key: attribute.key,
      value: attribute.value,
      position: attribute.position ?? index,
    }));
  }

  private normalizeImages(images: ProductImageInputDto[]) {
    const normalized = images.map((image, index) => ({
      url: image.url,
      alt: image.alt,
      position: image.position ?? index,
      isPrimary: image.isPrimary ?? false,
    }));
    if (normalized.length > 0 && !normalized.some((image) => image.isPrimary)) {
      normalized[0].isPrimary = true;
    }
    let primarySeen = false;
    return normalized.map((image) => {
      const isPrimary = image.isPrimary && !primarySeen;
      if (isPrimary) primarySeen = true;
      return { ...image, isPrimary };
    });
  }

  private variantData(variant: ProductVariantInputDto, position: number) {
    return {
      name: variant.name,
      sku: variant.sku,
      options: (variant.options ?? {}) as Prisma.InputJsonValue,
      price: decimal(variant.price),
      compareAtPrice: variant.compareAtPrice != null ? decimal(variant.compareAtPrice) : null,
      stockQty: variant.stockQty ?? 0,
      isActive: variant.isActive ?? true,
      position,
    };
  }

  private variantCreates(variants: ProductVariantInputDto[]) {
    return variants.map((variant, index) => this.variantData(variant, variant.position ?? index));
  }
}
