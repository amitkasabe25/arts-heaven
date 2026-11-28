import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OrderStatus,
  Payment,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  RefundStatus,
} from '@prisma/client';
import { Env } from '../common/config/env.validation';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { IdempotencyService } from '../common/idempotency/idempotency.service';
import { decimal, number } from '../common/utils/money.util';
import { NotificationsService } from '../notifications/notifications.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentProviderFactory } from './providers/provider.factory';
import { CreatePaymentDto, RefundPaymentDto, VerifyPaymentDto } from './dto/payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: PaymentProviderFactory,
    private readonly orders: OrdersService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly idempotency: IdempotencyService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async create(
    userId: string | undefined,
    guestToken: string | undefined,
    dto: CreatePaymentDto,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber: dto.orderNumber },
      include: { payments: true },
    });
    if (!order || !this.owns(order, userId, guestToken))
      throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.PAYMENT_PENDING)
      throw new BadRequestException('This order is not awaiting payment');
    if (order.paymentProvider !== dto.provider)
      throw new BadRequestException('This order was placed with a different payment provider');

    const existing = order.payments.find(
      (payment) =>
        payment.provider === dto.provider &&
        ([PaymentStatus.PENDING, PaymentStatus.AUTHORIZED] as PaymentStatus[]).includes(payment.status) &&
        payment.providerOrderId,
    );
    if (existing) {
      const metadata = existing.metadata as { checkout?: Record<string, unknown> };
      return { paymentId: existing.id, providerOrderId: existing.providerOrderId, ...(metadata.checkout ?? {}) };
    }

    const customer = {
      name: String((order.customerSnapshot as Prisma.JsonObject).name ?? 'Artsheaven customer'),
      email: order.guestEmail ?? '',
      phone: order.guestPhone ?? '',
    };
    const created = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        provider: dto.provider,
        amount: order.total,
        idempotencyKey: `pay_${order.id}`,
        attempts: 1,
      },
    });
    const providerOrderId = `ah_${created.id}`;
    const callbackUrl = `${this.config.get('APP_URL', { infer: true })}/order/${order.orderNumber}`;

    try {
      const result = await this.providers.get(dto.provider).createOrder({
        orderNumber: order.orderNumber,
        amountPaise: Math.round(number(order.total) * 100),
        currency: order.currency,
        customer,
        providerOrderId,
        callbackUrl,
      });
      const updated = await this.prisma.payment.update({
        where: { id: created.id },
        data: {
          providerOrderId: result.providerOrderId,
          metadata: { checkout: result.checkout } as Prisma.InputJsonValue,
        },
      });
      return {
        paymentId: updated.id,
        providerOrderId: result.providerOrderId,
        ...result.checkout,
      };
    } catch (error) {
      await this.prisma.payment.update({
        where: { id: created.id },
        data: { status: PaymentStatus.FAILED, failureReason: (error as Error).message },
      });
      throw error;
    }
  }

  /** Server-verifies a provider callback. The client's "success" alone is never trusted. */
  async verify(dto: VerifyPaymentDto, userId?: string, guestToken?: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { providerOrderId: dto.providerOrderId, provider: dto.provider },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: payment.orderId } });
    if (!this.owns(order, userId, guestToken)) throw new NotFoundException('Payment not found');
    if (payment.status === PaymentStatus.PAID) return this.paymentResponse(payment);

    const provider = this.providers.get(dto.provider);
    if (!provider.verifyCallback({
      providerOrderId: dto.providerOrderId,
      providerPaymentId: dto.providerPaymentId ?? '',
      signature: dto.signature ?? '',
    })) {
      throw new BadRequestException('Payment signature verification failed');
    }

    const remote = await provider.fetchPayment(dto.providerPaymentId ?? dto.providerOrderId);
    if (remote.amountPaise !== Math.round(number(payment.amount) * 100))
      throw new BadRequestException('Payment amount does not match the order total');

    if (remote.status === 'FAILED') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED, failureReason: 'Provider reported payment failure' },
      });
      await this.notifications.notify('PAYMENT_FAILURE', {
        userId: order.userId ?? undefined,
        orderId: order.id,
        email: order.guestEmail ?? undefined,
        data: { orderNumber: order.orderNumber },
      });
      throw new BadRequestException('Payment was not completed');
    }
    if (remote.status === 'PENDING') return this.paymentResponse(payment);

    return this.settle(payment.id, remote.providerPaymentId, remote.method);
  }

  /** Used by webhook processing. Idempotent: repeated calls return the same result. */
  async settle(
    paymentId: string,
    providerPaymentId: string,
    method?: string,
  ) {
    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (payment.status === PaymentStatus.PAID) return this.paymentResponse(payment);

    // markPaid owns its own transaction; keep this update outside it to avoid
    // nested interactive transactions on the same Prisma client.
    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.PAID,
        providerPaymentId,
        method: method ?? null,
        metadata: { ...((payment.metadata as object) ?? {}), providerPaymentId } as Prisma.InputJsonValue,
      },
    });
    await this.orders.markPaid(payment.orderId, providerPaymentId);

    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: payment.orderId } });
    await this.notifications.notify('PAYMENT_CONFIRMATION', {
      userId: order.userId ?? undefined,
      orderId: order.id,
      email: order.guestEmail ?? undefined,
      data: { orderNumber: order.orderNumber, total: number(order.total) },
    });
    return this.paymentResponse(updated);
  }

  async markFailed(paymentId: string, reason: string) {
    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (([PaymentStatus.PAID, PaymentStatus.REFUNDED] as PaymentStatus[]).includes(payment.status)) return;
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.FAILED, failureReason: reason },
    });
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: payment.orderId } });
    await this.notifications.notify('PAYMENT_FAILURE', {
      userId: order.userId ?? undefined,
      orderId: order.id,
      email: order.guestEmail ?? undefined,
      data: { orderNumber: order.orderNumber, reason },
    });
  }

  async findByProviderOrder(provider: PaymentProvider, providerOrderId: string) {
    return this.prisma.payment.findFirst({ where: { provider, providerOrderId } });
  }

  async findByProviderPayment(provider: PaymentProvider, providerPaymentId: string) {
    return this.prisma.payment.findFirst({ where: { provider, providerPaymentId } });
  }

  getById(id: string) {
    return this.prisma.payment.findUnique({ where: { id }, include: { refunds: true } });
  }

  async orderForPayment(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      select: { order: { select: { userId: true } } },
    });
    return payment?.order ?? null;
  }

  list(skip: number, take: number) {
    return this.prisma.$transaction([
      this.prisma.payment.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { order: { select: { orderNumber: true } } },
      }),
      this.prisma.payment.count(),
    ]);
  }

  async refund(paymentId: string, dto: RefundPaymentDto, actorId: string) {
    const claim = await this.idempotency.claim(dto.idempotencyKey, 'refund', paymentId, 1440);
    if (claim.replay) return claim.result;

    try {
      const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
      if (!([PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED] as PaymentStatus[]).includes(payment.status))
        throw new BadRequestException('Only a paid payment can be refunded');

      const refunded = await this.prisma.refund.aggregate({
        where: { paymentId, status: { not: RefundStatus.FAILED } },
        _sum: { amount: true },
      });
      const available = decimal(payment.amount).minus(refunded._sum.amount ?? 0);
      const requested = decimal(dto.amount ?? number(available));
      if (!requested.greaterThan(0) || requested.greaterThan(available))
        throw new BadRequestException('Refund amount exceeds the refundable balance');

      if (!payment.providerPaymentId)
        throw new BadRequestException('This payment has no provider reference to refund');

      const provider = this.providers.get(payment.provider);
      const refund = await this.prisma.refund.create({
        data: {
          paymentId,
          orderId: payment.orderId,
          amount: requested,
          reason: dto.reason,
          idempotencyKey: dto.idempotencyKey,
        },
      });
      try {
        const result = await provider.createRefund({
          providerPaymentId: payment.providerPaymentId,
          amountPaise: Math.round(number(requested) * 100),
          reason: dto.reason,
          refundId: refund.id,
        });
        const status =
          result.status === 'COMPLETED'
            ? RefundStatus.COMPLETED
            : result.status === 'FAILED'
              ? RefundStatus.FAILED
              : result.status === 'PROCESSING'
                ? RefundStatus.PROCESSING
                : RefundStatus.PENDING;
        const updated = await this.prisma.refund.update({
          where: { id: refund.id },
          data: { providerRefundId: result.providerRefundId, status },
        });
        await this.applyRefundTotals(payment, status === RefundStatus.COMPLETED);
        const order = await this.prisma.order.findUniqueOrThrow({ where: { id: payment.orderId } });
        await this.audit.record({
          action: 'payment.refund',
          entityType: 'Refund',
          entityId: refund.id,
          changes: { amount: number(requested), reason: dto.reason } as Record<string, unknown>,
          actor: { id: actorId, email: '', name: '', roles: [], permissions: [] },
        });
        await this.notifications.notify('REFUND_UPDATE', {
          userId: order.userId ?? undefined,
          orderId: order.id,
          email: order.guestEmail ?? undefined,
          data: { orderNumber: order.orderNumber, amount: number(requested), status },
        });
        const response = { refundId: updated.id, status: updated.status, amount: number(updated.amount) };
        await this.idempotency.complete(dto.idempotencyKey, 'refund', response);
        return response;
      } catch (error) {
        await this.prisma.refund.update({
          where: { id: refund.id },
          data: { status: RefundStatus.FAILED, providerRefundId: null },
        });
        throw error;
      }
    } catch (error) {
      await this.idempotency.release(dto.idempotencyKey, 'refund').catch(() => undefined);
      throw error;
    }
  }

  private async applyRefundTotals(payment: Payment, completed: boolean) {
    if (!completed) return;
    const refunded = await this.prisma.refund.aggregate({
      where: { paymentId: payment.id, status: RefundStatus.COMPLETED },
      _sum: { amount: true },
    });
    const totalRefunded = refunded._sum.amount ?? 0;
    const isFull = decimal(totalRefunded).greaterThanOrEqualTo(decimal(payment.amount).mul(0.999));
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: isFull ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED },
    });
    if (isFull)
      await this.prisma.order.update({
        where: { id: payment.orderId },
        data: { status: OrderStatus.REFUNDED },
      });
  }

  private owns(
    order: { userId: string | null; guestToken: string | null },
    userId?: string,
    guestToken?: string,
  ): boolean {
    if (userId && order.userId === userId) return true;
    if (!order.userId && guestToken && order.guestToken === guestToken) return true;
    return false;
  }

  private paymentResponse(payment: Payment) {
    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      provider: payment.provider,
      status: payment.status,
      amount: number(payment.amount),
      providerOrderId: payment.providerOrderId,
      providerPaymentId: payment.providerPaymentId,
    };
  }
}
