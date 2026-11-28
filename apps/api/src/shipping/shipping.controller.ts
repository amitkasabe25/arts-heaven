import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/access.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ApiMessage } from '../common/responses/response.interceptor';
import { decimal, number } from '../common/utils/money.util';
import { ShippingService } from './shipping.service';
import {
  CreateDeliverySlotDto,
  CreateDeliveryZoneDto,
  CreateGiftWrapDto,
  UpdateDeliveryZoneDto,
} from './dto/shipping.dto';

@ApiTags('Shipping & delivery')
@Controller('checkout')
export class ShippingController {
  constructor(private readonly shipping: ShippingService) {}

  @Public()
  @Get('slots')
  @ApiMessage('Delivery slots fetched successfully')
  slots() {
    return this.shipping.slots();
  }

  @Public()
  @Get('wraps')
  @ApiMessage('Gift wraps fetched successfully')
  wraps() {
    return this.shipping.wraps();
  }

  @Public()
  @Get('serviceability/:pincode')
  @ApiMessage('Pincode serviceability checked')
  async serviceability(@Param('pincode') pincode: string) {
    const quote = await this.shipping.quote(pincode, decimal(0));
    return quote;
  }

  @Public()
  @Post('serviceability')
  @ApiMessage('Pincode serviceability checked')
  async serviceabilityPost(@Body() body: { pincode: string; subtotal?: number }) {
    return this.shipping.quote(body.pincode, decimal(body.subtotal ?? 0));
  }
}

@ApiTags('Admin shipping')
@Controller('admin/shipping')
@UseGuards(JwtAuthGuard)
export class AdminShippingController {
  constructor(private readonly shipping: ShippingService) {}

  @Get('zones')
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER)
  @ApiMessage('Delivery zones fetched successfully')
  listZones() {
    return this.shipping.zones();
  }

  @Post('zones')
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER)
  @ApiMessage('Delivery zone created')
  createZone(@Body() dto: CreateDeliveryZoneDto) {
    return this.shipping.createZone(dto);
  }

  @Patch('zones/:id')
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER)
  @ApiMessage('Delivery zone updated')
  updateZone(@Param('id') id: string, @Body() dto: UpdateDeliveryZoneDto) {
    return this.shipping.updateZone(id, dto);
  }

  @Delete('zones/:id')
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER)
  @ApiMessage('Delivery zone deleted')
  async removeZone(@Param('id') id: string) {
    await this.shipping.removeZone(id);
    return { deleted: true };
  }

  @Post('slots')
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER)
  @ApiMessage('Delivery slot created')
  createSlot(@Body() dto: CreateDeliverySlotDto) {
    return this.shipping.createSlot(dto);
  }

  @Post('wraps')
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER)
  @ApiMessage('Gift wrap created')
  createWrap(@Body() dto: CreateGiftWrapDto) {
    return this.shipping.createWrap(dto);
  }
}
