import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/access.decorator';
import { ApiMessage } from '../common/responses/response.interceptor';
import { PaginationQueryDto } from '../common/pagination/pagination.dto';
import { AuditService } from '../common/audit/audit.service';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { InventoryService } from './inventory.service';

@ApiTags('Admin inventory')
@Controller('admin/inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER, RoleName.INVENTORY_MANAGER)
  @ApiMessage('Inventory fetched successfully')
  async list(@Query() query: PaginationQueryDto) {
    const [items, total] = await this.inventory.list(query.page, query.limit);
    return { data: items, meta: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) } };
  }

  @Get('low-stock')
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER, RoleName.INVENTORY_MANAGER)
  @ApiMessage('Low-stock items fetched successfully')
  lowStock(@Query('threshold') threshold?: string) {
    return this.inventory.lowStock(threshold ? Number(threshold) : 5);
  }

  @Post(':id/adjust')
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER, RoleName.INVENTORY_MANAGER)
  @ApiMessage('Stock adjusted successfully')
  async adjust(
    @Param('id') id: string,
    @Body() body: { delta: number; reason: string },
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.inventory.adjust(id, body.delta, body.reason, user.id);
    await this.audit.record({
      action: 'inventory.adjust',
      entityType: 'Inventory',
      entityId: id,
      changes: body as unknown as Record<string, unknown>,
      actor: user,
    });
    return result;
  }
}
