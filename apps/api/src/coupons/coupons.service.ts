import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Coupon, CouponType, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { decimal, number, subtract } from '../common/utils/money.util';
import { CreateCouponDto, UpdateCouponDto } from './dto/coupon.dto';

export interface CouponQuote {
  coupon: Coupon;
  discount: Prisma.Decimal;
  description: string;
}

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async validate(
    rawCode: string,
    subtotal: Prisma.Decimal,
    userId?: string,
    options: { productIds?: string[]; categoryIds?: string[] } = {},
  ): Promise<CouponQuote> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: rawCode.trim().toUpperCase() },
    });
    if (!coupon || !coupon.isActive) throw new BadRequestException('That coupon code is not valid');
    const now = new Date();
    if (coupon.startsAt > now || (coupon.expiresAt && coupon.expiresAt < now))
      throw new BadRequestException('That coupon code has expired');
    if (subtotal.lessThan(decimal(coupon.minSubtotal)))
      throw new BadRequestException(
        `Add ₹${number(subtract(decimal(coupon.minSubtotal), subtotal))} more to use ${coupon.code}`,
      );

    // Scoped coupons only count eligible lines toward their minimum and discount.
    let eligible = subtotal;
    if (coupon.productId || coupon.categoryId) {
      eligible = decimal(0);
      if (coupon.productId && options.productIds?.includes(coupon.productId))
        eligible = eligible.plus(subtotal);
      if (coupon.categoryId && options.categoryIds?.includes(coupon.categoryId))
        eligible = subtotal;
      if (eligible.isZero())
        throw new BadRequestException(`${coupon.code} does not apply to items in your cart`);
    }

    if (coupon.usageLimit != null) {
      const used = await this.prisma.couponUsage.count({ where: { couponId: coupon.id } });
      if (used >= coupon.usageLimit) throw new BadRequestException('This coupon is fully redeemed');
    }
    if (userId && coupon.perCustomerLimit != null) {
      const used = await this.prisma.couponUsage.count({
        where: { couponId: coupon.id, userId },
      });
      if (used >= coupon.perCustomerLimit)
        throw new BadRequestException('You have used this coupon the maximum number of times');
    }
    if (userId && coupon.firstOrderOnly) {
      const orders = await this.prisma.order.count({ where: { userId } });
      if (orders > 0) throw new BadRequestException('This coupon is for first orders only');
    }

    let discount =
      coupon.type === CouponType.PERCENT
        ? eligible.mul(coupon.value).div(100)
        : decimal(coupon.value);
    if (coupon.maxDiscount && discount.greaterThan(decimal(coupon.maxDiscount)))
      discount = decimal(coupon.maxDiscount);
    if (discount.greaterThan(eligible)) discount = eligible;

    return { coupon, discount, description: coupon.description ?? coupon.code };
  }

  async recordUsage(couponId: string, userId: string | undefined, orderId: string, discount: Prisma.Decimal) {
    return this.prisma.couponUsage.create({
      data: { couponId, userId, orderId, discount },
    });
  }

  list(skip: number, take: number) {
    return this.prisma.$transaction([
      this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.coupon.count(),
    ]);
  }

  async find(id: string): Promise<Coupon> {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return coupon;
  }

  create(dto: CreateCouponDto) {
    return this.prisma.coupon.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        type: dto.type,
        value: decimal(dto.value),
        minSubtotal: decimal(dto.minSubtotal ?? 0),
        maxDiscount: dto.maxDiscount != null ? decimal(dto.maxDiscount) : null,
        categoryId: dto.categoryId,
        productId: dto.productId,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : new Date(),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        usageLimit: dto.usageLimit,
        perCustomerLimit: dto.perCustomerLimit,
        firstOrderOnly: dto.firstOrderOnly ?? false,
        isActive: dto.isActive ?? true,
        description: dto.description,
      },
    });
  }

  update(id: string, dto: UpdateCouponDto) {
    return this.prisma.coupon.update({
      where: { id },
      data: {
        ...dto,
        value: dto.value != null ? decimal(dto.value) : undefined,
        minSubtotal: dto.minSubtotal != null ? decimal(dto.minSubtotal) : undefined,
        maxDiscount: dto.maxDiscount != null ? decimal(dto.maxDiscount) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.find(id);
    await this.prisma.coupon.delete({ where: { id } });
  }
}
