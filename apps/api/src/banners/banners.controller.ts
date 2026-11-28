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
import { BannersService } from './banners.service';
import { CreateBannerDto, ListBannersQueryDto, UpdateBannerDto } from './dto/banner.dto';

@ApiTags('Banners')
@Controller()
export class BannersController {
  constructor(private readonly banners: BannersService) {}

  @Get('banners')
  @Public()
  @ApiMessage('Banners fetched successfully')
  async listPublic(@Query() query: PaginationQueryDto) {
    const { items, total } = await this.banners.listActive(query);
    return { data: items, meta: paginationMeta(query.page, query.limit, total) };
  }

  @Get('admin/banners')
  @UseGuards(JwtAuthGuard)
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER)
  @ApiMessage('Banners fetched successfully')
  async list(@Query() query: ListBannersQueryDto) {
    const { items, total } = await this.banners.list(query);
    return { data: items, meta: paginationMeta(query.page, query.limit, total) };
  }

  @Post('admin/banners')
  @UseGuards(JwtAuthGuard)
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER)
  @ApiMessage('Banner created successfully')
  create(@Body() dto: CreateBannerDto) {
    return this.banners.create(dto);
  }

  @Patch('admin/banners/:id')
  @UseGuards(JwtAuthGuard)
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER)
  @ApiMessage('Banner updated successfully')
  update(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    return this.banners.update(id, dto);
  }

  @Delete('admin/banners/:id')
  @UseGuards(JwtAuthGuard)
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiMessage('Banner deleted successfully')
  async remove(@Param('id') id: string) {
    await this.banners.remove(id);
  }
}
