import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrderStatus, RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../auth/guards/optional-jwt.guard';
import { Roles } from '../common/decorators/access.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ApiMessage } from '../common/responses/response.interceptor';
import {
  PaginationQueryDto,
  paginationMeta,
  skipTake,
} from '../common/pagination/pagination.dto';
import { OrdersService } from './orders.service';
import { AdminNoteDto, CancelOrderDto, UpdateOrderStatusDto } from './dto/order.dto';

@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @ApiMessage('Orders fetched successfully')
  async list(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    const { skip, take } = skipTake(query.page, query.limit);
    const [items, total] = await this.orders.listForUser(user.id, skip, take);
    return { data: items, meta: paginationMeta(query.page, query.limit, total) };
  }

  @Public()
  @UseGuards(OptionalAuthGuard)
  @Get(':number')
  @ApiMessage('Order fetched successfully')
  get(
    @Param('number') number: string,
    @CurrentUser() user: AuthUser | null,
    @Headers('x-guest-token') guestToken?: string,
  ) {
    return this.orders.getByNumber(number, user?.id, guestToken);
  }

  @Post(':number/cancel')
  @ApiMessage('Order cancelled')
  async cancel(
    @Param('number') number: string,
    @Body() dto: CancelOrderDto,
    @CurrentUser() user: AuthUser,
  ) {
    const order = await this.orders.getByNumber(number, user.id);
    return this.orders.cancel(order.id, dto.reason, user.id, user.id);
  }
}

@ApiTags('Admin orders')
@Controller('admin/orders')
@UseGuards(JwtAuthGuard)
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER, RoleName.ORDER_MANAGER)
  @ApiMessage('Orders fetched successfully')
  async list(
    @Query() query: PaginationQueryDto,
    @Query('status') status?: OrderStatus,
    @Query('search') search?: string,
  ) {
    const { skip, take } = skipTake(query.page, query.limit);
    const [items, total] = await this.orders.listAdmin({ skip, take, status, search });
    return { data: items, meta: paginationMeta(query.page, query.limit, total) };
  }

  @Get(':id')
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER, RoleName.ORDER_MANAGER)
  @ApiMessage('Order fetched successfully')
  get(@Param('id') id: string) {
    return this.orders.getById(id);
  }

  @Get(':id/timeline')
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER, RoleName.ORDER_MANAGER)
  @ApiMessage('Order timeline fetched successfully')
  timeline(@Param('id') id: string) {
    return this.orders.statusHistory(id);
  }

  @Patch(':id/status')
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER, RoleName.ORDER_MANAGER)
  @ApiMessage('Order status updated')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.orders.updateStatus(id, dto.status, dto.note, user.id);
  }

  @Patch(':id/notes')
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER, RoleName.ORDER_MANAGER)
  @ApiMessage('Order notes updated')
  setNotes(@Param('id') id: string, @Body() dto: AdminNoteDto) {
    return this.orders.setAdminNotes(id, dto.note);
  }
}
