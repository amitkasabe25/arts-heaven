import { OrderStatus } from '@prisma/client';
import { assertTransition, ALLOWED_TRANSITIONS } from './order-transitions';

describe('order state machine', () => {
  it('allows the documented happy path', () => {
    expect(() => assertTransition(OrderStatus.PAYMENT_PENDING, OrderStatus.CONFIRMED)).not.toThrow();
    expect(() => assertTransition(OrderStatus.CONFIRMED, OrderStatus.PROCESSING)).not.toThrow();
    expect(() => assertTransition(OrderStatus.PROCESSING, OrderStatus.READY_TO_SHIP)).not.toThrow();
    expect(() => assertTransition(OrderStatus.READY_TO_SHIP, OrderStatus.SHIPPED)).not.toThrow();
    expect(() => assertTransition(OrderStatus.SHIPPED, OrderStatus.OUT_FOR_DELIVERY)).not.toThrow();
    expect(() => assertTransition(OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED)).not.toThrow();
  });

  it('rejects skipping and backward transitions', () => {
    expect(() => assertTransition(OrderStatus.PENDING, OrderStatus.DELIVERED)).toThrow();
    expect(() => assertTransition(OrderStatus.DELIVERED, OrderStatus.PROCESSING)).toThrow();
    expect(() => assertTransition(OrderStatus.SHIPPED, OrderStatus.CONFIRMED)).toThrow();
  });

  it('treats cancelled and refunded as terminal', () => {
    expect(ALLOWED_TRANSITIONS[OrderStatus.CANCELLED]).toHaveLength(0);
    expect(ALLOWED_TRANSITIONS[OrderStatus.REFUNDED]).toHaveLength(0);
    expect(() => assertTransition(OrderStatus.CANCELLED, OrderStatus.CONFIRMED)).toThrow();
  });

  it('allows cancelling only from pre-production states', () => {
    expect(() => assertTransition(OrderStatus.CONFIRMED, OrderStatus.CANCELLED)).not.toThrow();
    expect(() => assertTransition(OrderStatus.PROCESSING, OrderStatus.CANCELLED)).not.toThrow();
    expect(() => assertTransition(OrderStatus.DELIVERED, OrderStatus.CANCELLED)).toThrow();
  });
});
