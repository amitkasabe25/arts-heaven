import { Prisma } from '@prisma/client';

export type MoneyInput = number | string | Prisma.Decimal;

export function decimal(value: MoneyInput = 0): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) return value;
  // Never build a Decimal from a binary float: stringify first.
  return new Prisma.Decimal(typeof value === 'number' ? value.toFixed(2) : value);
}

export function number(value: MoneyInput = 0): number {
  return decimal(value).toNumber();
}

export function add(...values: MoneyInput[]): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>((sum, value) => sum.plus(decimal(value)), decimal(0));
}

export function subtract(a: MoneyInput, b: MoneyInput): Prisma.Decimal {
  return decimal(a).minus(decimal(b));
}

export function maxZero(value: MoneyInput): Prisma.Decimal {
  const result = decimal(value);
  return result.isNegative() ? decimal(0) : result;
}

export function isPositive(value: MoneyInput | null | undefined): boolean {
  return value != null && decimal(value).greaterThan(0);
}
