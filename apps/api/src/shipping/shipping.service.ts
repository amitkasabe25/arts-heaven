import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { decimal, number } from '../common/utils/money.util';
import {
  CreateDeliverySlotDto,
  CreateDeliveryZoneDto,
  CreateGiftWrapDto,
  UpdateDeliveryZoneDto,
} from './dto/shipping.dto';

export interface ShippingQuote {
  serviceable: boolean;
  zone: string;
  deliveryFee: Prisma.Decimal;
  estimatedMinDate: string;
  estimatedMaxDate: string;
  sameDayEligible: boolean;
}

@Injectable()
export class ShippingService {
  constructor(private readonly prisma: PrismaService) {}

  async quote(pincode: string, subtotal: Prisma.Decimal): Promise<ShippingQuote> {
    if (!/^[1-9]\d{5}$/.test(pincode)) throw new BadRequestException('Enter a valid 6-digit pincode');
    const zones = await this.prisma.deliveryZone.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    const zone =
      zones.find((z) => z.pincodePrefixes.some((prefix) => pincode.startsWith(prefix))) ??
      zones.find((z) => z.pincodePrefixes.length === 0);
    if (!zone) throw new BadRequestException('We do not deliver to this pincode yet');

    const fee = zone.freeAbove && subtotal.greaterThanOrEqualTo(decimal(zone.freeAbove))
      ? decimal(0)
      : decimal(zone.deliveryFee);
    const today = new Date();
    const min = new Date(today);
    min.setDate(min.getDate() + zone.estimatedDaysMin);
    const max = new Date(today);
    max.setDate(max.getDate() + zone.estimatedDaysMax);

    return {
      serviceable: true,
      zone: zone.name,
      deliveryFee: fee,
      estimatedMinDate: min.toISOString().slice(0, 10),
      estimatedMaxDate: max.toISOString().slice(0, 10),
      sameDayEligible: zone.sameDayEligible && new Date().getHours() < 14,
    };
  }

  slots() {
    return this.prisma.deliverySlot.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  wraps() {
    return this.prisma.giftWrap.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
  }

  /** Admin listing includes inactive zones so staff can re-enable them. */
  zones() {
    return this.prisma.deliveryZone.findMany({ orderBy: [{ createdAt: 'asc' }] });
  }

  async slotFee(slotId: string): Promise<Prisma.Decimal> {
    const slot = await this.prisma.deliverySlot.findUnique({ where: { id: slotId } });
    if (!slot || !slot.isActive) throw new BadRequestException('Invalid delivery slot');
    return decimal(slot.fee);
  }

  async wrapFee(wrapId: string | null | undefined): Promise<Prisma.Decimal> {
    if (!wrapId) return decimal(0);
    const wrap = await this.prisma.giftWrap.findUnique({ where: { id: wrapId } });
    if (!wrap || !wrap.isActive) throw new BadRequestException('Invalid gift wrap');
    return decimal(wrap.price);
  }

  createZone(dto: CreateDeliveryZoneDto) {
    return this.prisma.deliveryZone.create({
      data: {
        name: dto.name,
        pincodePrefixes: dto.pincodePrefixes,
        deliveryFee: decimal(dto.deliveryFee),
        freeAbove: dto.freeAbove != null ? decimal(dto.freeAbove) : null,
        estimatedDaysMin: dto.estimatedDaysMin ?? 1,
        estimatedDaysMax: dto.estimatedDaysMax ?? 2,
        sameDayEligible: dto.sameDayEligible ?? false,
        isActive: dto.isActive ?? true,
      },
    });
  }

  updateZone(id: string, dto: UpdateDeliveryZoneDto) {
    return this.prisma.deliveryZone.update({
      where: { id },
      data: {
        ...dto,
        deliveryFee: dto.deliveryFee != null ? decimal(dto.deliveryFee) : undefined,
        freeAbove: dto.freeAbove != null ? decimal(dto.freeAbove) : undefined,
      },
    });
  }

  createSlot(dto: CreateDeliverySlotDto) {
    return this.prisma.deliverySlot.create({
      data: {
        code: dto.code,
        label: dto.label,
        windowText: dto.windowText,
        fee: decimal(dto.fee ?? 0),
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  createWrap(dto: CreateGiftWrapDto) {
    return this.prisma.giftWrap.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        price: decimal(dto.price),
        isActive: dto.isActive ?? true,
      },
    });
  }

  async removeZone(id: string): Promise<void> {
    const zone = await this.prisma.deliveryZone.findUnique({ where: { id } });
    if (!zone) throw new NotFoundException('Delivery zone not found');
    await this.prisma.deliveryZone.delete({ where: { id } });
  }
}
