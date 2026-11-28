import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Order, OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { number } from '../common/utils/money.util';
import { NotificationsService } from '../notifications/notifications.service';
import { InventoryService } from '../inventory/inventory.service';
import { assertTransition } from './order-transitions';

const ORDER_INCLUDE = {
  items: { orderBy: { createdAt: 'asc' } },
  statusHistory: { orderBy: { createdAt: 'asc' } },
  payments: { orderBy: { createdAt: 'desc' } },
  refunds: { orderBy: { createdAt: 'desc' } },
} satisfies Prisma.OrderInclude;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
  ) {}

  listForUser(userId: string, skip: number, take: number) {
    return this.prisma.$transaction([
      this.prisma.order.findMany({
        where: { userId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { items: true, payments: { take: 1 } },
      }),
      this.prisma.order.count({ where: { userId } }),
    ]);
  }

  listAdmin(params: {
    skip: number;
    take: number;
    status?: OrderStatus;
    search?: string;
  }) {
    const where: Prisma.OrderWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.search
        ? {
            OR: [
              { orderNumber: { contains: params.search, mode: 'insensitive' as const } },
              { guestEmail: { contains: params.search, mode: 'insensitive' as const } },
              { guestPhone: { contains: params.search } },
            ],
          }
        : {}),
    };
    return this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: { items: true, payments: { take: 1 } },
      }),
      this.prisma.order.count({ where }),
    ]);
  }

  async getByNumber(orderNumber: string, userId?: string, guestToken?: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Order not found');

    // An order number alone is not a secret. Authenticated customers must own
    // the order; guests must present the same token they checked out with.
    if (userId) {
      if (order.userId !== userId) throw new NotFoundException('Order not found');
    } else if (guestToken) {
      if (order.guestToken !== guestToken) throw new NotFoundException('Order not found');
    } else {
      throw new NotFoundException('Order not found');
    }
    return this.serialize(order);
  }

  async getById(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async statusHistory(orderId: string) {
    await this.getById(orderId);
    return this.prisma.orderStatusHistory.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateStatus(
    orderId: string,
    to: OrderStatus,
    note: string | undefined,
    actorId: string,
  ) {
    const order = await this.getById(orderId);
    assertTransition(order.status, to);
    if (to === OrderStatus.REFUNDED) {
      const paidPayments = await this.prisma.payment.count({
        where: { orderId, status: { in: [PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED] } },
      });
      if (paidPayments > 0)
        throw new BadRequestException('Process the refund through the payment provider first');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.order.update({
        where: { id: orderId },
        data: {
          status: to,
          ...(to === OrderStatus.CANCELLED ? { cancelledAt: new Date() } : {}),
          ...(to === OrderStatus.DELIVERED ? { deliveredAt: new Date() } : {}),
        },
      });
      await tx.orderStatusHistory.create({
        data: { orderId, fromStatus: order.status, toStatus: to, note, changedByUserId: actorId },
      });
      if (to === OrderStatus.CANCELLED) {
        const reservations = await tx.stockReservation.findMany({
          where: { orderId, status: 'ACTIVE' },
          select: { id: true },
        });
        for (const reservation of reservations)
          await this.inventory.release(tx, reservation.id, 'order cancelled');
      }
      return result;
    });

    await this.audit.record({
      action: 'order.status_changed',
      entityType: 'Order',
      entityId: orderId,
      changes: { from: order.status, to, note },
      actor: { id: actorId, email: '', name: '', roles: [], permissions: [] },
    });
    await this.notifyStatus(updated.id, to);
    return this.serialize(updated);
  }

  async cancel(orderId: string, reason: string | undefined, actorId?: string, userId?: string) {
    const order = await this.getById(orderId);
    if (userId && order.userId !== userId) throw new NotFoundException('Order not found');
    if (!([OrderStatus.PENDING, OrderStatus.PAYMENT_PENDING, OrderStatus.CONFIRMED] as OrderStatus[]).includes(order.status))
      throw new BadRequestException('This order can no longer be cancelled');
    return this.updateStatus(orderId, OrderStatus.CANCELLED, reason ?? 'Cancelled by customer', actorId ?? 'customer');
  }

  async setAdminNotes(orderId: string, note: string) {
    await this.getById(orderId);
    const order = await this.prisma.order.update({ where: { id: orderId }, data: { adminNotes: note } });
    return { adminNotes: order.adminNotes };
  }

  /** Marks an order confirmed after verified payment. Safe to call repeatedly. */
  async markPaid(orderId: string, paymentId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      if (order.status === OrderStatus.CONFIRMED || order.status === OrderStatus.PROCESSING) return order;
      if (order.status !== OrderStatus.PAYMENT_PENDING && order.status !== OrderStatus.PENDING)
        return order;
      const reservations = await tx.stockReservation.findMany({
        where: { orderId, status: 'ACTIVE' },
        select: { id: true },
      });
      for (const reservation of reservations) await this.inventory.confirm(tx, reservation.id);
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CONFIRMED },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: OrderStatus.CONFIRMED,
          note: `Payment ${paymentId} verified`,
        },
      });
      return updated;
    });
  }

  private async notifyStatus(orderId: string, status: OrderStatus) {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    const event = `ORDER_${status}`;
    await this.notifications.notify(event, {
      userId: order.userId ?? undefined,
      orderId,
      email: order.guestEmail ?? undefined,
      phone: order.guestPhone ?? undefined,
      data: { orderNumber: order.orderNumber, status },
    });
  }

  private serialize(order: Order) {
    return {
      ...order,
      subtotal: number(order.subtotal),
      discount: number(order.discount),
      deliveryFee: number(order.deliveryFee),
      giftWrapFee: number(order.giftWrapFee),
      slotFee: number(order.slotFee),
      tax: number(order.tax),
      total: number(order.total),
    };
  }
}
