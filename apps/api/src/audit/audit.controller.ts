import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/access.decorator';
import { paginationMeta } from '../common/pagination/pagination.dto';
import { ApiMessage } from '../common/responses/response.interceptor';
import { AuditLogsService } from './audit-logs.service';
import { ListAuditLogsQueryDto } from './dto/audit-log.dto';

@ApiTags('Audit logs')
@Controller('audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly auditLogs: AuditLogsService) {}

  @Get()
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER)
  @ApiMessage('Audit logs fetched successfully')
  async list(@Query() query: ListAuditLogsQueryDto) {
    const { items, total } = await this.auditLogs.list(query);
    return { data: items, meta: paginationMeta(query.page, query.limit, total) };
  }
}
