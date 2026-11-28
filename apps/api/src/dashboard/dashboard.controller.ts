import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/access.decorator';
import { ApiMessage } from '../common/responses/response.interceptor';
import { DashboardService } from './dashboard.service';

@ApiTags('Admin dashboard')
@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER, RoleName.ORDER_MANAGER, RoleName.INVENTORY_MANAGER)
  @ApiMessage('Dashboard statistics fetched successfully')
  overview() {
    return this.dashboard.overview();
  }

  @Get('payments')
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER, RoleName.ORDER_MANAGER)
  @ApiMessage('Payment summary fetched successfully')
  payments() {
    return this.dashboard.paymentSummary();
  }

  @Get('low-stock')
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER, RoleName.INVENTORY_MANAGER)
  @ApiMessage('Low-stock items fetched successfully')
  lowStock(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.dashboard.lowStock((Number(page) - 1) * Number(limit), Number(limit));
  }

  @Get('failed-payments')
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER, RoleName.ORDER_MANAGER)
  @ApiMessage('Failed payments fetched successfully')
  failedPayments() {
    return this.dashboard.failedPayments();
  }
}
