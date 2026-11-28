import { Injectable } from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { number } from '../common/utils/money.util';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async overview() {
    const [
      paidOrders,
      orderCounts,
      customerCount,
      pendingCount,
      bestSellers,
      recentOrders,
      salesByDay,
      lowStock,
    ] = await this.prisma.$transaction([
      this.prisma.order.aggregate({
        where: {
          status: {
            in: [OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.READY_TO_SHIP,
              OrderStatus.SHIPPED, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED],
          },
        },
        _sum: { total: true },
        _count: { id: true },
        _avg: { total: true },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        _count: { id: true },
        orderBy: { status: 'asc' },
      }),
      this.prisma.user.count({ where: { roles: { some: { name: 'CUSTOMER' } } } }),
      this.prisma.order.count({
        where: { status: { in: [OrderStatus.PENDING, OrderStatus.PAYMENT_PENDING] } },
      }),
      this.prisma.orderItem.groupBy({
        by: ['productId', 'nameSnapshot'],
        _sum: { quantity: true, lineTotal: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 8,
      }),
      this.prisma.order.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          createdAt: true,
          guestEmail: true,
          items: { select: { nameSnapshot: true, quantity: true }, take: 2 },
        },
      }),
      this.prisma.$queryRaw<Array<{ day: string; revenue: Prisma.Decimal; orders: bigint }>>`
        SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day,
               COALESCE(SUM("total"), 0) AS revenue,
               COUNT(*) AS orders
        FROM "Order"
        WHERE "createdAt" >= now() - interval '6 days'
          AND "status" NOT IN ('CANCELLED', 'PENDING', 'PAYMENT_PENDING')
        GROUP BY 1
        ORDER BY 1 ASC`,
      this.prisma.inventory.findMany({
        where: { quantity: { lte: 5 } },
        take: 8,
        orderBy: { quantity: 'asc' },
        include: { product: { select: { name: true, sku: true } } },
      }),
    ]);

    // $transaction's heterogeneous tuple widening loses the precise aggregate shapes.
    const counts = orderCounts as unknown as Array<{ status: OrderStatus; _count: { id: number } }>;
    const sellers = bestSellers as unknown as Array<{
      productId: string | null;
      nameSnapshot: string;
      _sum: { quantity: number | null; lineTotal: Prisma.Decimal | null };
    }>;
    const completed = counts.find((row) => row.status === OrderStatus.DELIVERED)?._count.id ?? 0;
    const revenue = paidOrders._sum.total ?? 0;

    return {
      revenue: number(revenue),
      totalOrders: paidOrders._count.id,
      pendingOrders: pendingCount,
      completedOrders: completed,
      totalCustomers: customerCount,
      averageOrderValue: number(paidOrders._avg.total ?? 0),
      ordersByStatus: counts.map((row) => ({ status: row.status, count: row._count.id })),
      bestSellers: sellers.map((row) => ({
        productId: row.productId,
        name: row.nameSnapshot,
        unitsSold: row._sum.quantity ?? 0,
        revenue: number(row._sum.lineTotal ?? 0),
      })),
      recentOrders: recentOrders.map((order) => ({ ...order, total: number(order.total) })),
      salesTrend: salesByDay.map((row) => ({
        day: row.day,
        revenue: number(row.revenue),
        orders: Number(row.orders),
      })),
      lowStock: lowStock.map((item) => ({
        inventoryId: item.id,
        name: item.product?.name ?? 'Variant',
        sku: item.product?.sku ?? null,
        quantity: item.quantity,
      })),
    };
  }

  async paymentSummary() {
    const rows = await this.prisma.payment.groupBy({
      by: ['status', 'provider'],
      _count: { id: true },
      orderBy: { status: 'asc' },
    });
    return rows.map((row) => ({ status: row.status, provider: row.provider, count: row._count.id }));
  }

  async lowStock(skip = 0, take = 20) {
    return this.inventory.lowStock(5, skip, take);
  }

  async failedPayments() {
    const payments = await this.prisma.payment.findMany({
      where: { status: { in: [PaymentStatus.FAILED] } },
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: { order: { select: { orderNumber: true } } },
    });
    return payments.map((payment) => ({ ...payment, amount: number(payment.amount) }));
  }
}
