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
import { ReportStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  create(@CurrentUser('sub') reporterId: string, @Body() dto: CreateReportDto) {
    return this.reportsService.create(reporterId, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Get()
  findAll(@Query('status') status?: ReportStatus) {
    return this.reportsService.findAll(status);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: ReportStatus) {
    return this.reportsService.updateStatus(id, status);
  }
}
