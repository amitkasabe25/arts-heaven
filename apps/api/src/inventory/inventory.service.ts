import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StockMovement } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

export interface StockLine {
  productId?: string;
  variantId?: string;
  quantity: number;
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  private key(productId?: string, variantId?: string): string {
    if (variantId) return `v:${variantId}`;
    if (productId) return `p:${productId}`;
    throw new ConflictException('A stock line needs a product or a variant');
  }

  /** Idempotently creates the inventory row for a product or variant. */
  async ensure(db: Db, productId?: string, variantId?: string, quantity = 0) {
    const stockKey = this.key(productId, variantId);
    const existing = await db.inventory.findUnique({ where: { stockKey } });
    if (existing) return existing;
    return db.inventory.create({
      data: {
        stockKey,
        productId: productId ?? null,
        variantId: variantId ?? null,
        quantity,
      },
    });
  }

  async list(skip: number, take: number) {
    return this.prisma.$transaction([
      this.prisma.inventory.findMany({
        skip,
        take,
        orderBy: { quantity: 'asc' },
        include: { product: { select: { name: true, sku: true } }, variant: { select: { name: true, sku: true } } },
      }),
      this.prisma.inventory.count(),
    ]);
  }

  async adjust(
    inventoryId: string,
    delta: number,
    reason: string,
    changedByUserId?: string,
  ) {
    if (!Number.isInteger(delta) || delta === 0)
      throw new ConflictException('Adjustment must be a non-zero integer');
    return this.prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findUnique({ where: { id: inventoryId } });
      if (!inventory) throw new NotFoundException('Inventory record not found');
      const next = inventory.quantity + delta;
      if (next < 0) throw new ConflictException('Adjustment cannot make stock negative');
      const updated = await tx.inventory.update({
        where: { id: inventoryId },
        data: { quantity: next },
      });
      await tx.inventoryTransaction.create({
        data: {
          inventoryId,
          movement: StockMovement.ADJUSTMENT,
          quantity: delta,
          reason: changedByUserId ? `${reason} (by ${changedByUserId})` : reason,
          referenceType: 'manual',
        },
      });
      await this.syncMirror(tx, inventory, delta);
      return updated;
    });
  }

  /** Atomic, concurrency-safe reservation: fails when available stock is insufficient. */
  async reserve(
    db: Db,
    lines: StockLine[],
    context: { cartId?: string; orderId?: string; expiresAt: Date },
  ): Promise<string[]> {
    const reservationIds: string[] = [];
    for (const line of lines) {
      const inventory = await this.ensure(db, line.productId, line.variantId);
      const updated = await db.$queryRaw<Array<{ id: string }>>`
        UPDATE "Inventory"
        SET "reserved" = "reserved" + ${line.quantity}, "updatedAt" = now()
        WHERE "id" = ${inventory.id} AND "quantity" - "reserved" >= ${line.quantity}
        RETURNING "id"`;
      if (updated.length === 0)
        throw new ConflictException('An item in your cart is no longer available in that quantity');

      const reservation = await db.stockReservation.create({
        data: {
          inventoryId: inventory.id,
          cartId: context.cartId,
          orderId: context.orderId,
          quantity: line.quantity,
          expiresAt: context.expiresAt,
        },
      });
      reservationIds.push(reservation.id);
      await db.inventoryTransaction.create({
        data: {
          inventoryId: inventory.id,
          movement: StockMovement.RESERVATION,
          quantity: -line.quantity,
          reason: 'checkout reservation',
          referenceType: context.orderId ? 'order' : 'cart',
          referenceId: context.orderId ?? context.cartId,
        },
      });
    }
    return reservationIds;
  }

  /** Permanently deducts stock when payment is confirmed. Idempotent per reservation. */
  async confirm(db: Db, reservationId: string): Promise<void> {
    const reservation = await db.stockReservation.findUnique({ where: { id: reservationId } });
    if (!reservation || reservation.status !== 'ACTIVE') return;
    const updated = await db.$queryRaw<Array<{ id: string }>>`
      UPDATE "Inventory"
      SET "quantity" = "quantity" - ${reservation.quantity},
          "reserved" = "reserved" - ${reservation.quantity},
          "updatedAt" = now()
      WHERE "id" = ${reservation.inventoryId} AND "reserved" >= ${reservation.quantity}
      RETURNING "id"`;
    if (updated.length === 0) throw new ConflictException('Stock reservation could not be confirmed');
    await db.stockReservation.update({
      where: { id: reservationId },
      data: { status: 'CONFIRMED' },
    });
    await db.inventoryTransaction.create({
      data: {
        inventoryId: reservation.inventoryId,
        movement: StockMovement.SALE,
        quantity: -reservation.quantity,
        reason: 'payment confirmed',
        referenceType: 'reservation',
        referenceId: reservationId,
      },
    });
    const inventory = await db.inventory.findUniqueOrThrow({ where: { id: reservation.inventoryId } });
    await this.syncMirror(db, inventory, -reservation.quantity);
  }

  async release(db: Db, reservationId: string, reason = 'reservation released'): Promise<void> {
    const reservation = await db.stockReservation.findUnique({ where: { id: reservationId } });
    if (!reservation || reservation.status !== 'ACTIVE') return;
    const updated = await db.$queryRaw<Array<{ id: string }>>`
      UPDATE "Inventory"
      SET "reserved" = GREATEST(0, "reserved" - ${reservation.quantity}), "updatedAt" = now()
      WHERE "id" = ${reservation.inventoryId}
      RETURNING "id"`;
    if (updated.length === 0) throw new ConflictException('Stock reservation could not be released');
    await db.stockReservation.update({
      where: { id: reservationId },
      data: { status: reason.includes('expired') ? 'EXPIRED' : 'RELEASED' },
    });
    await db.inventoryTransaction.create({
      data: {
        inventoryId: reservation.inventoryId,
        movement: StockMovement.RELEASE,
        quantity: reservation.quantity,
        reason,
        referenceType: 'reservation',
        referenceId: reservationId,
      },
    });
  }

  async releaseOrderStock(orderId: string, reason: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const reservations = await tx.stockReservation.findMany({
        where: { orderId, status: 'ACTIVE' },
      });
      for (const reservation of reservations) await this.release(tx, reservation.id, reason);
    });
  }

  async expireReservations(): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const expired = await tx.stockReservation.findMany({
        where: { status: 'ACTIVE', expiresAt: { lt: new Date() } },
        select: { id: true },
      });
      for (const row of expired) await this.release(tx, row.id, 'reservation expired');
      return expired.length;
    });
  }

  lowStock(threshold = 5, skip = 0, take = 20) {
    return this.prisma.inventory.findMany({
      where: { quantity: { lte: threshold } },
      skip,
      take,
      orderBy: { quantity: 'asc' },
      include: { product: { select: { name: true, sku: true } }, variant: { select: { name: true } } },
    });
  }

  private async syncMirror(
    db: Db,
    inventory: { productId: string | null; variantId: string | null },
    delta: number,
  ): Promise<void> {
    if (inventory.variantId) {
      await db.productVariant.update({
        where: { id: inventory.variantId },
        data: { stockQty: { increment: delta } },
      });
    } else if (inventory.productId) {
      await db.product.update({
        where: { id: inventory.productId },
        data: { stockQty: { increment: delta } },
      });
    }
  }
}
