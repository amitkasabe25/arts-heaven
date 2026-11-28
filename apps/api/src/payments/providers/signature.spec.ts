import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { Env } from '../../common/config/env.validation';
import { CashfreeProvider } from './cashfree.provider';
import { RazorpayProvider } from './razorpay.provider';

function config(values: Record<string, string>): ConfigService<Env, true> {
  return { get: jest.fn((key: string) => values[key]) } as unknown as ConfigService<Env, true>;
}

describe('payment signature verification', () => {
  const secret = 'test_key_secret_1234567890';

  describe('Razorpay', () => {
    const provider = new RazorpayProvider(
      config({
        RAZORPAY_KEY_ID: 'rzp_test_123',
        RAZORPAY_KEY_SECRET: secret,
        RAZORPAY_WEBHOOK_SECRET: 'webhook_secret_123',
      }),
    );

    it('accepts a correctly signed callback', () => {
      const orderId = 'order_1';
      const paymentId = 'pay_1';
      const signature = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
      expect(provider.verifyCallback({ providerOrderId: orderId, providerPaymentId: paymentId, signature })).toBe(true);
    });

    it('rejects tampered or missing signatures', () => {
      expect(
        provider.verifyCallback({
          providerOrderId: 'order_1',
          providerPaymentId: 'pay_1',
          signature: 'deadbeef',
        }),
      ).toBe(false);
      expect(
        provider.verifyCallback({ providerOrderId: 'order_1', providerPaymentId: 'pay_1', signature: '' }),
      ).toBe(false);
    });

    it('verifies webhook signatures against the raw body', () => {
      const rawBody = '{"event":"payment.captured"}';
      const signature = createHmac('sha256', 'webhook_secret_123').update(rawBody).digest('hex');
      expect(provider.verifyWebhook({ rawBody, headers: { 'x-razorpay-signature': signature } })).toBe(true);
      expect(provider.verifyWebhook({ rawBody, headers: { 'x-razorpay-signature': 'bad' } })).toBe(false);
    });
  });

  describe('Cashfree', () => {
    const provider = new CashfreeProvider(
      config({ CASHFREE_CLIENT_ID: 'cf_test', CASHFREE_CLIENT_SECRET: 'cf_secret', CASHFREE_ENVIRONMENT: 'TEST' }),
    );

    it('verifies webhook signatures over timestamp + raw body', () => {
      const rawBody = '{"type":"PAYMENT_SUCCESS_WEBHOOK"}';
      const timestamp = '1700000000';
      const signature = createHmac('sha256', 'cf_secret').update(timestamp + rawBody).digest('hex');
      expect(
        provider.verifyWebhook({
          rawBody,
          headers: { 'x-cf-signature': signature, 'x-cf-timestamp': timestamp },
        }),
      ).toBe(true);
    });

    it('rejects webhooks without a timestamp or signature', () => {
      expect(provider.verifyWebhook({ rawBody: '{}', headers: {} })).toBe(false);
    });
  });
});
