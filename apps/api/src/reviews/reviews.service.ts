import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma, Review, ReviewStatus } from '@prisma/client';
import { PaginationQueryDto, skipTake } from '../common/pagination/pagination.dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateReviewDto, ListReviewsQueryDto } from './dto/review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForProduct(slug: string, query: PaginationQueryDto) {
    const product = await this.productBySlug(slug);
    const where: Prisma.ReviewWhereInput = {
      productId: product.id,
      status: ReviewStatus.APPROVED,
    };
    const { skip, take } = skipTake(query.page, query.limit);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: query.order === 'asc' ? 'asc' : 'desc' },
        select: {
          id: true,
          rating: true,
          title: true,
          body: true,
          imageUrls: true,
          isVerifiedPurchase: true,
          createdAt: true,
          user: { select: { id: true, name: true } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);
    return { items, total };
  }

  async listMine(userId: string, query: PaginationQueryDto) {
    const where: Prisma.ReviewWhereInput = { userId };
    const { skip, take } = skipTake(query.page, query.limit);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: query.order === 'asc' ? 'asc' : 'desc' },
        select: {
          id: true,
          rating: true,
          title: true,
          body: true,
          status: true,
          isVerifiedPurchase: true,
          imageUrls: true,
          createdAt: true,
          product: { select: { id: true, slug: true, name: true } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);
    return { items, total };
  }

  async listForAdmin(query: ListReviewsQueryDto) {
    const where: Prisma.ReviewWhereInput = {
      status: query.status ?? ReviewStatus.PENDING,
    };
    const { skip, take } = skipTake(query.page, query.limit);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: query.order === 'asc' ? 'asc' : 'desc' },
        include: {
          product: { select: { id: true, slug: true, name: true } },
          user: { select: { id: true, name: true, email: true } },
          order: { select: { id: true, orderNumber: true } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);
    return { items, total };
  }

  async create(userId: string, slug: string, dto: CreateReviewDto): Promise<Review> {
    const product = await this.productBySlug(slug);

    const existing = await this.prisma.review.findUnique({
      where: { productId_userId: { productId: product.id, userId } },
    });
    if (existing) throw new ConflictException('You have already reviewed this product');

    const deliveredOrder = await this.prisma.order.findFirst({
      where: {
        userId,
        status: OrderStatus.DELIVERED,
        items: { some: { productId: product.id } },
      },
      orderBy: { deliveredAt: 'desc' },
      select: { id: true },
    });
    if (!deliveredOrder)
      throw new ForbiddenException('You can only review products from a delivered order');

    return this.prisma.review.create({
      data: {
        productId: product.id,
        userId,
        orderId: deliveredOrder.id,
        rating: dto.rating,
        title: dto.title,
        body: dto.body,
        imageUrls: dto.imageUrls ?? [],
        status: ReviewStatus.PENDING,
        isVerifiedPurchase: true,
      },
    });
  }

  /** Approve/reject a review and refresh the product's cached rating aggregate. */
  async moderate(id: string, status: ReviewStatus): Promise<Review> {
    const review = await this.prisma.review.findUnique({
      where: { id },
      select: { id: true, productId: true },
    });
    if (!review) throw new NotFoundException('Review not found');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.review.update({ where: { id }, data: { status } });
      await this.recomputeProductRating(tx, review.productId);
      return updated;
    });
  }

  private async recomputeProductRating(
    tx: Prisma.TransactionClient,
    productId: string,
  ): Promise<void> {
    const aggregate = await tx.review.aggregate({
      where: { productId, status: ReviewStatus.APPROVED },
      _avg: { rating: true },
      _count: { rating: true },
    });
    const count = aggregate._count.rating;
    const average = count === 0 ? 0 : Math.round((aggregate._avg.rating ?? 0) * 10) / 10;

    await tx.product.update({
      where: { id: productId },
      data: { ratingAverage: average, ratingCount: count },
    });
  }

  private async productBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true, slug: true, name: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }
}
