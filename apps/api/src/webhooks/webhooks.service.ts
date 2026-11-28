import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PaymentProvider, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { PaymentProviderFactory } from '../payments/providers/provider.factory';
import { PaymentsService } from '../payments/payments.service';

export interface WebhookResult {
  received: boolean;
  duplicate?: boolean;
  processed?: boolean;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: PaymentProviderFactory,
    private readonly payments: PaymentsService,
  ) {}

  async handle(
    provider: PaymentProvider,
    rawBody: string,
    payload: Record<string, unknown>,
    headers: Record<string, string | undefined>,
  ): Promise<WebhookResult> {
    const adapter = this.providers.get(provider);
    if (!adapter.verifyWebhook({ rawBody, headers }))
      throw new UnauthorizedException('Webhook signature verification failed');

    const externalId = adapter.webhookEventId(payload, headers);
    let eventId: string;
    try {
      const event = await this.prisma.paymentWebhookEvent.create({
        data: {
          provider,
          externalId,
          eventType: String(payload.event ?? payload.type ?? 'unknown'),
          payload: payload as Prisma.InputJsonValue,
          signatureVerified: true,
        },
      });
      eventId = event.id;
    } catch {
      // Unique(provider, externalId) violation means a redelivery — safe to ignore.
      return { received: true, duplicate: true };
    }

    try {
      const parsed = adapter.parseWebhook(payload);
      const payment =
        (parsed.providerPaymentId
          ? await this.payments.findByProviderPayment(provider, parsed.providerPaymentId)
          : null) ??
        (parsed.providerOrderId
          ? await this.payments.findByProviderOrder(provider, parsed.providerOrderId)
          : null);

      if (!payment) {
        await this.prisma.paymentWebhookEvent.update({
          where: { id: eventId },
          data: { processedAt: new Date(), error: 'No matching payment record' },
        });
        return { received: true, processed: false };
      }

      if (parsed.status === 'PAID') {
        // Re-query the provider for the authoritative amount before settling.
        const remote = await adapter.fetchPayment(parsed.providerPaymentId ?? parsed.providerOrderId ?? '');
        if (remote.status === 'PAID' && remote.amountPaise === Math.round(Number(payment.amount) * 100))
          await this.payments.settle(payment.id, remote.providerPaymentId, remote.method);
      } else if (parsed.status === 'FAILED') {
        await this.payments.markFailed(payment.id, parsed.eventType);
      }

      await this.prisma.paymentWebhookEvent.update({
        where: { id: eventId },
        data: { processedAt: new Date() },
      });
      return { received: true, processed: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Webhook ${externalId} processing failed: ${message}`);
      await this.prisma.paymentWebhookEvent.update({
        where: { id: eventId },
        data: { error: message },
      });
      throw error;
    }
  }
}
