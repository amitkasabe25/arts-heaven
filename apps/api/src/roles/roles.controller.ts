import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/access.decorator';
import { ApiMessage } from '../common/responses/response.interceptor';
import { RolesService } from './roles.service';

@ApiTags('Roles & permissions')
@Controller('roles')
@UseGuards(JwtAuthGuard)
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER)
  @ApiMessage('Roles fetched successfully')
  list() {
    return this.roles.list();
  }

  @Get('permissions')
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER)
  @ApiMessage('Permissions fetched successfully')
  permissions() {
    return this.roles.listPermissions();
  }
}
