import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { RegisterDeviceDto } from './dto/register-device.dto';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser('sub') userId: string) {
    return this.notificationsService.list(userId);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.notificationsService.markRead(id, userId);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser('sub') userId: string) {
    return this.notificationsService.markAllRead(userId);
  }

  @Post('device-token')
  registerDevice(
    @CurrentUser('sub') userId: string,
    @Body() dto: RegisterDeviceDto,
  ) {
    return this.notificationsService.registerDevice(userId, dto);
  }
}
