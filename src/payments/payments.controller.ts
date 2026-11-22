import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';
import { SubmitPaymentNoteDto } from './dto/submit-payment-note.dto';
import { RejectPaymentDto } from './dto/reject-payment.dto';
import { UpdatePaymentSettingsDto } from './dto/update-payment-settings.dto';

const qrStorage = diskStorage({
  destination: './uploads/payment-settings',
  filename: (_req, file, cb) =>
    cb(null, `qr-${randomUUID()}${extname(file.originalname)}`),
});

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // ---------- عامة ----------

  @Get('settings')
  getSettings() {
    return this.paymentsService.getSettings();
  }

  @Get('packages')
  getPackages() {
    return this.paymentsService.getActivePackages();
  }

  // ---------- المستخدم ----------

  @UseGuards(JwtAuthGuard)
  @Get('mine')
  getMine(@CurrentUser('sub') userId: string) {
    return this.paymentsService.getMyPaymentRequests(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('packages/:packageId/purchase')
  purchasePackage(
    @CurrentUser('sub') userId: string,
    @Param('packageId') packageId: string,
  ) {
    return this.paymentsService.purchasePackage(userId, packageId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/note')
  addNote(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: SubmitPaymentNoteDto,
  ) {
    return this.paymentsService.addNote(id, userId, dto.senderNote);
  }

  // ---------- الأدمن ----------

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('admin/pending')
  getPending() {
    return this.paymentsService.getPendingForAdmin();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('admin/:id/confirm')
  confirm(@Param('id') id: string, @CurrentUser('sub') adminId: string) {
    return this.paymentsService.confirm(id, adminId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('admin/:id/reject')
  reject(
    @Param('id') id: string,
    @CurrentUser('sub') adminId: string,
    @Body() dto: RejectPaymentDto,
  ) {
    return this.paymentsService.reject(id, adminId, dto.reason);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('admin/settings')
  updateSettings(@Body() dto: UpdatePaymentSettingsDto) {
    return this.paymentsService.updateSettings(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('admin/settings/qr-image')
  @UseInterceptors(FileInterceptor('file', { storage: qrStorage }))
  async uploadQrImage(@UploadedFile() file: Express.Multer.File) {
    return this.paymentsService.updateQrImage(
      `/uploads/payment-settings/${file.filename}`,
    );
  }
}
