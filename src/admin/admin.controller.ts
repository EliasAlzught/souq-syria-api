import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminService } from './admin.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  // ملاحظة: مسارات موافقة/رفض الإعلانات موجودة بـ ListingsController تحت admin/*
  // ومسارات البلاغات موجودة بـ ReportsController - كلها محمية بنفس RolesGuard
}
