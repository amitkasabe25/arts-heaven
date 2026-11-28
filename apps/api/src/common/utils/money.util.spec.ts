import { decimal, add, subtract, maxZero, number, isPositive } from './money.util';

describe('money utilities', () => {
  it('uses fixed-point arithmetic without binary float drift', () => {
    expect(add('0.1', '0.2').toFixed(2)).toBe('0.30');
    expect(subtract('100.00', '0.10').toFixed(2)).toBe('99.90');
    expect(add(decimal('499.99'), 49).toFixed(2)).toBe('548.99');
  });

  it('never returns a negative total', () => {
    expect(maxZero('-12.50').toFixed(2)).toBe('0.00');
    expect(maxZero('12.50').toFixed(2)).toBe('12.50');
  });

  it('converts to a number only at the API boundary', () => {
    expect(number('1234.56')).toBe(1234.56);
    expect(isPositive('0')).toBe(false);
    expect(isPositive('1')).toBe(true);
  });
});
