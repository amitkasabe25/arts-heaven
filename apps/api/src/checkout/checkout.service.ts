import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, PaymentProvider } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { IdempotencyService } from '../common/idempotency/idempotency.service';
import { add, decimal, maxZero, number, subtract } from '../common/utils/money.util';
import { CartService } from '../cart/cart.service';
import { CouponsService } from '../coupons/coupons.service';
import { ShippingService } from '../shipping/shipping.service';
import { InventoryService, StockLine } from '../inventory/inventory.service';
import { CustomizationService } from '../product-customization/product-customization.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CheckoutQuoteDto, PlaceOrderDto } from './dto/checkout.dto';

export interface CheckoutQuote {
  items: Array<{
    cartItemId: string;
    name: string;
    quantity: number;
    unitPrice: Prisma.Decimal;
    lineTotal: Prisma.Decimal;
    productId: string | null;
    variantId: string | null;
    snapshot: Prisma.JsonValue;
    customizations: Prisma.JsonValue;
    uploadedAssetIds: string[];
  }>;
  subtotal: Prisma.Decimal;
  discount: Prisma.Decimal;
  deliveryFee: Prisma.Decimal;
  giftWrapFee: Prisma.Decimal;
  slotFee: Prisma.Decimal;
  tax: Prisma.Decimal;
  total: Prisma.Decimal;
  couponCode: string | null;
  pincode: string;
  shipping: Awaited<ReturnType<ShippingService['quote']>>;
}

@Injectable()
export class CheckoutService {
  private readonly reservationTtlMinutes = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly coupons: CouponsService,
    private readonly shipping: ShippingService,
    private readonly inventory: InventoryService,
    private readonly customization: CustomizationService,
    private readonly idempotency: IdempotencyService,
    private readonly notifications: NotificationsService,
  ) {}

  async quote(
    userId: string | undefined,
    guestToken: string | undefined,
    dto: CheckoutQuoteDto,
  ): Promise<CheckoutQuote> {
    const cart = await this.cart.findOrCreate(userId, guestToken);
    const items = await this.cart.listItems(cart.id);
    if (items.length === 0) throw new BadRequestException('Your cart is empty');

    const priced: CheckoutQuote['items'] = [];
    for (const item of items) {
      const snapshot = item.productSnapshot as Prisma.JsonObject;
      if (!item.productId) {
        const lineTotal = decimal(item.unitPriceSnapshot).mul(item.quantity);
        priced.push({
          cartItemId: item.id,
          name: String(snapshot.name ?? 'Gift box'),
          quantity: item.quantity,
          unitPrice: decimal(item.unitPriceSnapshot),
          lineTotal,
          productId: null,
          variantId: null,
          snapshot: item.productSnapshot,
          customizations: item.customizations,
          uploadedAssetIds: item.uploadedAssetIds,
        });
        continue;
      }
      const product = await this.prisma.product.findFirst({
        where: { id: item.productId, status: 'ACTIVE', deletedAt: null },
        include: {
          variants: true,
          category: true,
          customizationSchemas: { include: { fields: { orderBy: { position: 'asc' } } } },
        },
      });
      if (!product || !product.category.isVisible)
        throw new BadRequestException(`${String(snapshot.name)} is no longer available`);
      const variant = item.variantId ? product.variants.find((v) => v.id === item.variantId) : null;
      const available = variant?.stockQty ?? product.stockQty;
      if (available < item.quantity)
        throw new BadRequestException(`${product.name} is only available in ${available}`);

      const resolved = await this.customization.validateAndPrice(
        product.customizationSchemas.flatMap((schema) => schema.fields),
        item.customizations as Array<{ fieldKey: string; value: unknown }>,
        item.uploadedAssetIds,
      );
      const unitPrice = add(variant?.price ?? product.sellingPrice, resolved.extra);
      priced.push({
        cartItemId: item.id,
        name: product.name,
        quantity: item.quantity,
        unitPrice,
        lineTotal: unitPrice.mul(item.quantity),
        productId: product.id,
        variantId: variant?.id ?? null,
        snapshot: {
          productId: product.id,
          variantId: variant?.id ?? null,
          name: product.name,
          sku: variant?.sku ?? product.sku,
          image: String(snapshot.image ?? ''),
          variantSnapshot: variant?.options ?? {},
          customizations: resolved.values,
        } as unknown as Prisma.JsonValue,
        customizations: resolved.values as unknown as Prisma.JsonValue,
        uploadedAssetIds: resolved.assetIds,
      });
    }

    const subtotal = priced.reduce((sum, item) => sum.plus(item.lineTotal), decimal(0));
    const address = dto.addressId
      ? await this.prisma.address.findUnique({ where: { id: dto.addressId } })
      : null;
    if (dto.addressId && (!address || (userId && address.userId !== userId)))
      throw new BadRequestException('Invalid delivery address');
    const pincode = address?.pincode ?? dto.pincode;
    if (!pincode) throw new BadRequestException('Choose a delivery address or enter a pincode');

    const shipping = await this.shipping.quote(pincode, subtotal);
    const slotFee = dto.slotId ? await this.shipping.slotFee(dto.slotId) : decimal(0);
    const giftWrapFee = await this.shipping.wrapFee(dto.giftWrapId);
    let discount = decimal(0);
    let couponCode: string | null = null;
    const code = dto.couponCode ?? cart.couponCode;
    if (code) {
      const quote = await this.coupons.validate(code, subtotal, userId, {
        productIds: priced.map((item) => item.productId).filter((id): id is string => !!id),
        categoryIds: [],
      });
      discount = quote.discount;
      couponCode = quote.coupon.code;
    }

    const taxRate = await this.taxRate();
    const taxableBase = maxZero(subtract(subtotal, discount));
    const tax = taxableBase.mul(taxRate).div(100);
    const total = maxZero(add(taxableBase, shipping.deliveryFee, giftWrapFee, slotFee, tax));

    return {
      items: priced,
      subtotal,
      discount,
      deliveryFee: shipping.deliveryFee,
      giftWrapFee,
      slotFee,
      tax,
      total,
      couponCode,
      pincode,
      shipping,
    };
  }

  /** Returns a JSON-safe version of the quote for API responses. */
  async quoteJson(userId: string | undefined, guestToken: string | undefined, dto: CheckoutQuoteDto) {
    const quote = await this.quote(userId, guestToken, dto);
    return {
      ...quote,
      items: quote.items.map((item) => ({
        ...item,
        unitPrice: number(item.unitPrice),
        lineTotal: number(item.lineTotal),
      })),
      subtotal: number(quote.subtotal),
      discount: number(quote.discount),
      deliveryFee: number(quote.deliveryFee),
      giftWrapFee: number(quote.giftWrapFee),
      slotFee: number(quote.slotFee),
      tax: number(quote.tax),
      total: number(quote.total),
    };
  }

  async place(
    userId: string | undefined,
    guestToken: string | undefined,
    dto: PlaceOrderDto,
    idempotencyKey: string | undefined,
  ) {
    const scope = userId ? `user:${userId}` : `guest:${guestToken}`;
    const fingerprint = JSON.stringify({ ...dto, cartToken: guestToken });
    if (idempotencyKey) {
      const claim = await this.idempotency.claim(idempotencyKey, 'checkout', fingerprint);
      if (claim.replay) return claim.result;
    }

    try {
      const cart = await this.cart.findOrCreate(userId, guestToken);
      const quote = await this.quote(userId, guestToken, dto);
      const address = dto.addressId
        ? await this.prisma.address.findUnique({ where: { id: dto.addressId } })
        : null;
      if (dto.addressId && (!address || (userId && address.userId !== userId)))
        throw new UnauthorizedException('Invalid delivery address');

      const recipient = address
        ? { name: address.name, phone: address.phone, addressLine: address.addressLine, city: address.city, pincode: address.pincode }
        : {
            name: dto.recipientName,
            phone: dto.recipientPhone,
            addressLine: dto.addressLine,
            city: dto.city,
            pincode: quote.pincode,
          };
      if (!recipient.name || !recipient.phone || !recipient.addressLine || !recipient.city)
        throw new BadRequestException('Complete the delivery address');

      const customer = userId
        ? await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })
        : null;
      const customerEmail = customer?.email ?? dto.customerEmail;
      const customerPhone = customer?.phone ?? dto.customerPhone;
      if (!customerEmail || !customerPhone)
        throw new BadRequestException('Customer email and phone are required');

      const deliveryDate = dto.deliveryDate
        ? new Date(`${dto.deliveryDate}T12:00:00Z`)
        : new Date(Date.now() + 86400000);
      const daysAhead = (deliveryDate.getTime() - Date.now()) / 86400000;
      if (daysAhead < -1 || daysAhead > 31) throw new BadRequestException('Choose a delivery date within 30 days');

      const orderNumber = await this.nextOrderNumber();
      const status = dto.paymentProvider === PaymentProvider.COD ? 'CONFIRMED' : 'PAYMENT_PENDING';
      const stockLines: StockLine[] = quote.items.map((item) => ({
        productId: item.productId ?? undefined,
        variantId: item.variantId ?? undefined,
        quantity: item.quantity,
      }));

      const result = await this.prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            orderNumber,
            userId: userId ?? null,
            guestEmail: customer?.email ?? customerEmail,
            guestPhone: customerPhone,
            status,
            customerSnapshot: {
              name: customer?.name ?? recipient.name,
              email: customerEmail,
              phone: customerPhone,
            },
            addressSnapshot: recipient as unknown as Prisma.InputJsonValue,
            deliveryDate,
            deliverySlotId: dto.slotId ?? null,
            giftWrapId: dto.giftWrapId ?? null,
            cardMessage: dto.cardMessage ?? null,
            subtotal: quote.subtotal,
            discount: quote.discount,
            deliveryFee: quote.deliveryFee,
            giftWrapFee: quote.giftWrapFee,
            slotFee: quote.slotFee,
            tax: quote.tax,
            total: quote.total,
            currency: 'INR',
            idempotencyKey,
            guestToken: userId ? null : guestToken,
            paymentProvider: dto.paymentProvider,
            items: {
              create: quote.items.map((item) => ({
                productId: item.productId,
                variantId: item.variantId,
                nameSnapshot: item.name,
                skuSnapshot: String((item.snapshot as Prisma.JsonObject).sku ?? ''),
                imageSnapshot: String((item.snapshot as Prisma.JsonObject).image ?? ''),
                variantSnapshot: ((item.snapshot as Prisma.JsonObject).variantSnapshot ?? {}) as Prisma.InputJsonValue,
                customizations: item.customizations as Prisma.InputJsonValue,
                uploadedAssetIds: item.uploadedAssetIds,
                unitPrice: item.unitPrice,
                quantity: item.quantity,
                lineTotal: item.lineTotal,
              })),
            },
            statusHistory: {
              create: { fromStatus: 'PENDING', toStatus: status, note: 'Order placed' },
            },
          },
          include: { items: true },
        });

        const reservationIds = await this.inventory.reserve(tx, stockLines, {
          orderId: order.id,
          expiresAt: new Date(Date.now() + this.reservationTtlMinutes * 60_000),
        });
        // Cash on delivery is confirmed at placement, so deduct stock immediately.
        if (dto.paymentProvider === PaymentProvider.COD) {
          for (const reservationId of reservationIds)
            await this.inventory.confirm(tx, reservationId);
        }

        if (quote.couponCode) {
          const coupon = await tx.coupon.findUniqueOrThrow({
            where: { code: quote.couponCode },
          });
          await this.coupons.recordUsage(coupon.id, userId, order.id, quote.discount);
        }

        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
        await tx.cart.update({ where: { id: cart.id }, data: { status: 'CONVERTED', couponCode: null } });

        return order;
      });

      await this.notifications.notify('ORDER_CONFIRMATION', {
        userId,
        orderId: result.id,
        email: customerEmail,
        data: { orderNumber: result.orderNumber, total: number(result.total) },
      });

      const response = {
        orderId: result.id,
        orderNumber: result.orderNumber,
        status: result.status,
        total: number(result.total),
        paymentProvider: dto.paymentProvider,
      };
      if (idempotencyKey) await this.idempotency.complete(idempotencyKey, 'checkout', response);
      return response;
    } catch (error) {
      if (idempotencyKey) await this.idempotency.release(idempotencyKey, 'checkout').catch(() => undefined);
      throw error;
    }
  }

  private async taxRate(): Promise<number> {
    const setting = await this.prisma.storeSetting.findUnique({ where: { key: 'public.tax_rate' } });
    const value = setting?.value as { rate?: number } | null;
    return typeof value?.rate === 'number' ? value.rate : 0;
  }

  private async nextOrderNumber(): Promise<string> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.prisma.order.count({
      where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    });
    return `AH-${today}-${String(count + 1).padStart(4, '0')}`;
  }
}
