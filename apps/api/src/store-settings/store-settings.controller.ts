import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/access.decorator';
import { Public } from '../common/decorators/public.decorator';
import { PaginationQueryDto, paginationMeta } from '../common/pagination/pagination.dto';
import { ApiMessage } from '../common/responses/response.interceptor';
import { CreateStoreSettingDto, UpdateStoreSettingDto } from './dto/store-setting.dto';
import { StoreSettingsService } from './store-settings.service';

@ApiTags('Store settings')
@Controller()
export class StoreSettingsController {
  constructor(private readonly settings: StoreSettingsService) {}

  @Get('store-settings/public')
  @Public()
  @ApiMessage('Public store settings fetched successfully')
  listPublic() {
    return this.settings.listPublic();
  }

  @Get('admin/store-settings')
  @UseGuards(JwtAuthGuard)
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER)
  @ApiMessage('Store settings fetched successfully')
  async list(@Query() query: PaginationQueryDto) {
    const { items, total } = await this.settings.list(query);
    return { data: items, meta: paginationMeta(query.page, query.limit, total) };
  }

  @Post('admin/store-settings')
  @UseGuards(JwtAuthGuard)
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER)
  @ApiMessage('Store setting created successfully')
  create(@Body() dto: CreateStoreSettingDto) {
    return this.settings.create(dto);
  }

  @Patch('admin/store-settings/:key')
  @UseGuards(JwtAuthGuard)
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER)
  @ApiMessage('Store setting updated successfully')
  update(@Param('key') key: string, @Body() dto: UpdateStoreSettingDto) {
    return this.settings.update(key, dto);
  }

  @Delete('admin/store-settings/:key')
  @UseGuards(JwtAuthGuard)
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiMessage('Store setting deleted successfully')
  async remove(@Param('key') key: string) {
    await this.settings.remove(key);
  }
}
