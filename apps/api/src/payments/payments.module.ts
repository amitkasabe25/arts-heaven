import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module';
import {
  AdminPaymentsController,
  PaymentsController,
} from './payments.controller';
import { PaymentsService } from './payments.service';
import { CashfreeProvider } from './providers/cashfree.provider';
import { PaymentProviderFactory } from './providers/provider.factory';
import { RazorpayProvider } from './providers/razorpay.provider';

@Module({
  imports: [NotificationsModule, OrdersModule],
  controllers: [PaymentsController, AdminPaymentsController],
  providers: [PaymentsService, PaymentProviderFactory, RazorpayProvider, CashfreeProvider],
  exports: [PaymentsService, PaymentProviderFactory],
})
export class PaymentsModule {}
