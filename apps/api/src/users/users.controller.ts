import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { Roles } from '../common/decorators/access.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiMessage } from '../common/responses/response.interceptor';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { paginationMeta, skipTake } from '../common/pagination/pagination.dto';
import { PaginationQueryDto } from '../common/pagination/pagination.dto';
import { CreateStaffDto, SetActiveDto, UpdateProfileDto } from './dto/admin-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER)
  @ApiMessage('Customers fetched successfully')
  async list(@Query() query: PaginationQueryDto, @Query('search') search?: string) {
    const { items, total } = await this.users.list({ ...skipTake(query.page, query.limit), search });
    return { data: items, meta: paginationMeta(query.page, query.limit, total) };
  }

  @Post('staff')
  @Roles(RoleName.SUPER_ADMIN)
  @ApiMessage('Staff account created successfully')
  async createStaff(@Body() dto: CreateStaffDto) {
    const user = await this.users.createStaff(dto);
    return { id: user.id, email: user.email, name: user.name };
  }

  @Patch(':id/active')
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER)
  @ApiMessage('Account status updated')
  async setActive(@Param('id') id: string, @Body() dto: SetActiveDto) {
    const user = await this.users.setActive(id, dto.isActive);
    return { id: user.id, isActive: user.isActive };
  }

  @Patch('me/profile')
  @ApiMessage('Profile updated successfully')
  async updateProfile(@Body() dto: UpdateProfileDto, @CurrentUser() user: AuthUser) {
    const updated = await this.users.updateProfile(user.id, dto);
    return { id: updated.id, name: updated.name, phone: updated.phone };
  }
}
