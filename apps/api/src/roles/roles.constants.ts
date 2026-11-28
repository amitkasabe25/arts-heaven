import { RoleName } from '@prisma/client';

export const PERMISSION_KEYS = [
  'catalog.read',
  'catalog.write',
  'orders.read',
  'orders.write',
  'orders.refund',
  'inventory.read',
  'inventory.write',
  'customers.read',
  'customers.write',
  'coupons.write',
  'shipping.write',
  'reviews.moderate',
  'payments.read',
  'settings.write',
  'audit.read',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const ROLE_PERMISSIONS: Record<RoleName, PermissionKey[]> = {
  SUPER_ADMIN: [...PERMISSION_KEYS],
  STORE_MANAGER: [
    'catalog.read',
    'catalog.write',
    'orders.read',
    'orders.write',
    'inventory.read',
    'customers.read',
    'coupons.write',
    'shipping.write',
    'reviews.moderate',
    'payments.read',
    'settings.write',
  ],
  ORDER_MANAGER: ['orders.read', 'orders.write', 'customers.read', 'payments.read'],
  INVENTORY_MANAGER: ['catalog.read', 'inventory.read', 'inventory.write'],
  CUSTOMER: [],
};
