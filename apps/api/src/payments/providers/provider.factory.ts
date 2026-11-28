import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';
import { CashfreeProvider } from './cashfree.provider';
import { PaymentProviderAdapter } from './payment-provider.interface';
import { RazorpayProvider } from './razorpay.provider';

@Injectable()
export class PaymentProviderFactory {
  constructor(
    private readonly razorpay: RazorpayProvider,
    private readonly cashfree: CashfreeProvider,
  ) {}

  get(name: PaymentProvider): PaymentProviderAdapter {
    switch (name) {
      case PaymentProvider.RAZORPAY:
        return this.razorpay;
      case PaymentProvider.CASHFREE:
        return this.cashfree;
      default:
        throw new Error(`No payment provider adapter is registered for ${name}`);
    }
  }
}
