import {
  Body,
  Controller,
  Delete,
  Get,
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
import { ApiMessage } from '../common/responses/response.interceptor';
import {
  CreateFieldDto,
  CreateSchemaDto,
  SchemaQueryDto,
  UpdateFieldDto,
  UpdateSchemaDto,
} from './dto/customization.dto';
import { CustomizationService } from './product-customization.service';

const CATALOGUE_ADMINS = [RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER] as const;

@ApiTags('Product Customization')
@Controller('product-customization')
@UseGuards(JwtAuthGuard)
@Roles(...CATALOGUE_ADMINS)
export class ProductCustomizationController {
  constructor(private readonly customization: CustomizationService) {}

  @Get('schemas')
  @ApiMessage('Customization schemas fetched successfully')
  list(@Query() query: SchemaQueryDto) {
    return this.customization.listSchemas(query);
  }

  @Post('schemas')
  @ApiMessage('Customization schema created successfully')
  createSchema(@Body() dto: CreateSchemaDto) {
    return this.customization.createSchema(dto);
  }

  @Patch('schemas/:id')
  @ApiMessage('Customization schema updated successfully')
  updateSchema(@Param('id') id: string, @Body() dto: UpdateSchemaDto) {
    return this.customization.updateSchema(id, dto);
  }

  @Delete('schemas/:id')
  @ApiMessage('Customization schema deleted successfully')
  async deleteSchema(@Param('id') id: string) {
    await this.customization.deleteSchema(id);
    return { deleted: true };
  }

  @Post('schemas/:id/fields')
  @ApiMessage('Customization field created successfully')
  createField(@Param('id') schemaId: string, @Body() dto: CreateFieldDto) {
    return this.customization.createField(schemaId, dto);
  }

  @Patch('fields/:id')
  @ApiMessage('Customization field updated successfully')
  updateField(@Param('id') id: string, @Body() dto: UpdateFieldDto) {
    return this.customization.updateField(id, dto);
  }

  @Delete('fields/:id')
  @ApiMessage('Customization field deleted successfully')
  async deleteField(@Param('id') id: string) {
    await this.customization.deleteField(id);
    return { deleted: true };
  }
}
