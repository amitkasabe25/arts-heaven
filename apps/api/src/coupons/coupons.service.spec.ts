import { Coupon, CouponType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { decimal } from '../common/utils/money.util';
import { CouponsService } from './coupons.service';

function coupon(overrides: Partial<Coupon> = {}): Coupon {
  return {
    id: 'c1',
    code: 'TEST10',
    type: CouponType.PERCENT,
    value: decimal(10),
    minSubtotal: decimal(0),
    maxDiscount: null,
    categoryId: null,
    productId: null,
    startsAt: new Date('2020-01-01'),
    expiresAt: null,
    usageLimit: null,
    perCustomerLimit: null,
    firstOrderOnly: false,
    isActive: true,
    description: null,
    createdAt: new Date('2020-01-01'),
    updatedAt: new Date('2020-01-01'),
    ...overrides,
  } as Coupon;
}

describe('CouponsService.validate', () => {
  let prisma: {
    coupon: { findUnique: jest.Mock };
    couponUsage: { count: jest.Mock };
    order: { count: jest.Mock };
  };
  let service: CouponsService;

  beforeEach(() => {
    prisma = {
      coupon: { findUnique: jest.fn() },
      couponUsage: { count: jest.fn().mockResolvedValue(0) },
      order: { count: jest.fn().mockResolvedValue(0) },
    };
    service = new CouponsService(prisma as unknown as PrismaService);
  });

  it('calculates a percentage discount server-side and caps it', async () => {
    prisma.coupon.findUnique.mockResolvedValue(coupon({ value: decimal(10), maxDiscount: decimal(50) }));
    const result = await service.validate('test10', decimal(1000));
    expect(result.discount.toFixed(2)).toBe('50.00');
    expect(result.coupon.code).toBe('TEST10');
  });

  it('applies a fixed discount without exceeding the subtotal', async () => {
    prisma.coupon.findUnique.mockResolvedValue(
      coupon({ type: CouponType.FIXED, value: decimal(1200) }),
    );
    const result = await service.validate('TEST10', decimal(1000));
    expect(result.discount.toFixed(2)).toBe('1000.00');
  });

  it('rejects an inactive or expired coupon', async () => {
    prisma.coupon.findUnique.mockResolvedValue(coupon({ isActive: false }));
    await expect(service.validate('TEST10', decimal(1000))).rejects.toThrow(/not valid/);

    prisma.coupon.findUnique.mockResolvedValue(coupon({ expiresAt: new Date('2020-02-01') }));
    await expect(service.validate('TEST10', decimal(1000))).rejects.toThrow(/expired/);
  });

  it('enforces minimum subtotal, usage limits and first-order rules', async () => {
    prisma.coupon.findUnique.mockResolvedValue(coupon({ minSubtotal: decimal(2000) }));
    await expect(service.validate('TEST10', decimal(1000))).rejects.toThrow(/Add/);

    prisma.coupon.findUnique.mockResolvedValue(
      coupon({ minSubtotal: decimal(0), usageLimit: 3 }),
    );
    prisma.couponUsage.count.mockResolvedValue(3);
    await expect(service.validate('TEST10', decimal(1000))).rejects.toThrow(/fully redeemed/);

    prisma.couponUsage.count.mockResolvedValue(0);
    prisma.coupon.findUnique.mockResolvedValue(coupon({ firstOrderOnly: true }));
    prisma.order.count.mockResolvedValue(2);
    await expect(service.validate('TEST10', decimal(1000), 'u1')).rejects.toThrow(/first orders/);
  });
});
