import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { add, decimal, number } from '../common/utils/money.util';
import { CustomizationService } from '../product-customization/product-customization.service';
import { AddCartItemDto } from './dto/cart.dto';

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customization: CustomizationService,
  ) {}

  async get(userId?: string, guestToken?: string) {
    return this.findOrCreate(userId, guestToken);
  }

  listItems(cartId: string) {
    return this.prisma.cartItem.findMany({
      where: { cartId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOrCreate(userId?: string, guestToken?: string) {
    if (!userId && !guestToken) throw new BadRequestException('A guest token is required');

    if (userId) {
      const existing = await this.prisma.cart.findFirst({
        where: { userId, status: 'ACTIVE' },
        orderBy: { updatedAt: 'desc' },
      });
      if (existing) return existing;
      return this.prisma.cart.create({ data: { userId } });
    }

    // guestToken is unique for the lifetime of a browser. Once the previous
    // cart is converted or abandoned we must reset it in place; creating a new
    // row with the same token would violate the unique constraint.
    const existing = await this.prisma.cart.findUnique({ where: { guestToken } });
    if (existing) {
      return existing.status === 'ACTIVE' ? existing : this.resetGuestCart(existing.id);
    }

    try {
      return await this.prisma.cart.create({ data: { guestToken } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const raced = await this.prisma.cart.findUnique({ where: { guestToken } });
        if (raced) {
          return raced.status === 'ACTIVE' ? raced : this.resetGuestCart(raced.id);
        }
      }
      throw error;
    }
  }

  private resetGuestCart(cartId: string) {
    return this.prisma.cart.update({
      where: { id: cartId },
      data: {
        status: 'ACTIVE',
        couponCode: null,
        items: { deleteMany: {} },
      },
    });
  }

  async add(userId: string | undefined, guestToken: string | undefined, dto: AddCartItemDto) {
    const cart = await this.findOrCreate(userId, guestToken);
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: dto.productId, status: 'ACTIVE', deletedAt: null },
        include: {
          variants: true,
          category: true,
          images: { orderBy: { position: 'asc' }, take: 1 },
          customizationSchemas: {
            include: { fields: { orderBy: { position: 'asc' } } },
          },
        },
      });
      if (!product || !product.category.isVisible)
        throw new NotFoundException('Product is not available');

      const variant = dto.variantId
        ? product.variants.find((v) => v.id === dto.variantId && v.isActive)
        : undefined;
      if (dto.variantId && !variant) throw new BadRequestException('Variant is not available');
      if (product.productType !== 'BUILD_A_BOX' && !product.trackStock) {
        // Non-stock products are always available.
      } else if ((variant?.stockQty ?? product.stockQty) < dto.quantity) {
        throw new BadRequestException('Requested quantity is not available');
      }

      const resolved = await this.customization.validateAndPrice(
        product.customizationSchemas.flatMap((schema) => schema.fields),
        dto.customizations ?? [],
        dto.uploadedAssetIds ?? [],
      );

      const basePrice = variant?.price ?? product.sellingPrice;
      const unitPrice = add(basePrice, resolved.extra);
      const snapshot = {
        productId: product.id,
        variantId: variant?.id ?? null,
        name: product.name,
        sku: variant?.sku ?? product.sku,
        image: product.images[0]?.url ?? null,
        variantName: variant?.name ?? null,
        options: variant?.options ?? {},
      };

      const existing = await tx.cartItem.findFirst({
        where: {
          cartId: cart.id,
          productId: product.id,
          variantId: variant?.id ?? null,
        },
      });
      if (existing) {
        const sameCustomization =
          JSON.stringify(existing.customizations) === JSON.stringify(resolved.values) &&
          JSON.stringify(existing.uploadedAssetIds) === JSON.stringify(resolved.assetIds);
        if (sameCustomization) {
          return tx.cartItem.update({
            where: { id: existing.id },
            data: { quantity: Math.min(10, existing.quantity + dto.quantity) },
          });
        }
      }

      return tx.cartItem.create({
        data: {
          cartId: cart.id,
          productId: product.id,
          variantId: variant?.id ?? null,
          productSnapshot: snapshot,
          quantity: dto.quantity,
          customizations: resolved.values as unknown as Prisma.InputJsonValue,
          uploadedAssetIds: resolved.assetIds,
          unitPriceSnapshot: unitPrice,
        },
      });
    });
  }

  async updateQuantity(userId: string | undefined, guestToken: string | undefined, itemId: string, quantity: number) {
    const cart = await this.findOrCreate(userId, guestToken);
    const item = await this.prisma.cartItem.findFirst({ where: { id: itemId, cartId: cart.id } });
    if (!item) throw new NotFoundException('Cart item not found');
    return this.prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
  }

  async remove(userId: string | undefined, guestToken: string | undefined, itemId: string) {
    const cart = await this.findOrCreate(userId, guestToken);
    const item = await this.prisma.cartItem.findFirst({ where: { id: itemId, cartId: cart.id } });
    if (!item) throw new NotFoundException('Cart item not found');
    await this.prisma.cartItem.delete({ where: { id: item.id } });
    return { deleted: true };
  }

  async clear(userId?: string, guestToken?: string): Promise<void> {
    const cart = await this.findOrCreate(userId, guestToken);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    await this.prisma.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
  }

  async setCoupon(userId: string | undefined, guestToken: string | undefined, code: string | null) {
    const cart = await this.findOrCreate(userId, guestToken);
    return this.prisma.cart.update({
      where: { id: cart.id },
      data: { couponCode: code ? code.trim().toUpperCase() : null },
    });
  }

  async merge(userId: string, guestToken: string) {
    const guest = await this.prisma.cart.findFirst({
      where: { guestToken, status: 'ACTIVE' },
      include: { items: true },
    });
    if (!guest || guest.items.length === 0) return { merged: 0 };
    return this.prisma.$transaction(async (tx) => {
      const userCart = await this.findOrCreateTx(tx, userId);
      let merged = 0;
      for (const item of guest.items) {
        const existing = await tx.cartItem.findFirst({
          where: {
            cartId: userCart.id,
            productId: item.productId,
            variantId: item.variantId,
            customizations: { equals: item.customizations as Prisma.InputJsonValue },
          },
        });
        if (existing) {
          await tx.cartItem.update({
            where: { id: existing.id },
            data: { quantity: Math.min(10, existing.quantity + item.quantity) },
          });
        } else {
          await tx.cartItem.create({
            data: {
              cartId: userCart.id,
              productId: item.productId,
              variantId: item.variantId,
              productSnapshot: item.productSnapshot as Prisma.InputJsonValue,
              quantity: item.quantity,
              customizations: item.customizations as Prisma.InputJsonValue,
              uploadedAssetIds: item.uploadedAssetIds,
              unitPriceSnapshot: item.unitPriceSnapshot,
            },
          });
        }
        merged += 1;
      }
      await tx.cart.update({ where: { id: guest.id }, data: { status: 'ABANDONED' } });
      return { merged };
    });
  }

  /** Subtotal is always recomputed from current server-side prices. */
  async reprice(items: Array<{ productId: string | null; variantId: string | null; quantity: number }>) {
    let subtotal = decimal(0);
    for (const item of items) {
      if (!item.productId) {
        // Custom boxes carry their price in the snapshot; handled by checkout quote.
        continue;
      }
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
        include: { variants: true },
      });
      if (!product || product.status !== 'ACTIVE') throw new BadRequestException('Cart item is unavailable');
      const variant = item.variantId ? product.variants.find((v) => v.id === item.variantId) : null;
      const available = variant?.stockQty ?? product.stockQty;
      if (available < item.quantity) throw new BadRequestException(`${product.name} is low on stock`);
      subtotal = subtotal.plus(decimal(variant?.price ?? product.sellingPrice).mul(item.quantity));
    }
    return subtotal;
  }

  summary(cart: { items: Array<{ quantity: number; unitPriceSnapshot: Prisma.Decimal }> }) {
    return {
      count: cart.items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: number(cart.items.reduce((sum, item) => sum.plus(item.unitPriceSnapshot.mul(item.quantity)), decimal(0))),
    };
  }

  private async findOrCreateTx(tx: Prisma.TransactionClient, userId: string) {
    const existing = await tx.cart.findFirst({ where: { userId, status: 'ACTIVE' } });
    if (existing) return existing;
    return tx.cart.create({ data: { userId } });
  }
}
