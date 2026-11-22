import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseService } from './firebase.service';
import { RegisterDeviceDto } from './dto/register-device.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseService,
    private readonly config: ConfigService,
  ) {}

  async registerDevice(userId: string, dto: RegisterDeviceDto) {
    const device = await this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      update: { userId, platform: dto.platform },
      create: { userId, token: dto.token, platform: dto.platform },
    });

    // كل جهاز بيشترك تلقائياً بـ topic الإعلانات الجديدة حتى يوصله إشعار "إعلان جديد" لكل المستخدمين
    const topic = this.config.get<string>('firebase.newListingsTopic')!;
    await this.firebase.subscribeToTopic(dto.token, topic);

    return device;
  }

  async list(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(id: string, userId: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
    return { message: 'تم التحديث' };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { message: 'تم تحديث كل الإشعارات' };
  }

  /**
   * إشعار داخلي (in-app) + Push لمستخدم واحد محدد.
   * تُستدعى من موديولات تانية (الشات، اعتماد الإعلان، تأكيد الدفع...).
   */
  async notify(userId: string, title: string, body: string) {
    const notification = await this.prisma.notification.create({
      data: { userId, title, body },
    });

    const devices = await this.prisma.deviceToken.findMany({
      where: { userId },
    });
    await this.firebase.sendToTokens(
      devices.map((d) => d.token),
      title,
      body,
    );

    return notification;
  }

  /**
   * بث إشعار لكل المستخدمين (مثلاً عند نشر إعلان جديد فعلياً بعد موافقة الأدمن).
   * ما بينشئ صفوف Notification لكل مستخدم (ممكن يصير عدد ضخم)، بس بيبعت Push عام عبر topic.
   */
  async broadcastNewListing(
    title: string,
    areaCity: string,
    areaDistrict: string,
  ) {
    const topic = this.config.get<string>('firebase.newListingsTopic')!;
    const body = `تم نشر إعلان عن "${title}" بمنطقة ${areaDistrict}، ${areaCity}`;
    this.logger.log(`📢 Broadcasting: ${body}`);
    await this.firebase.sendToTopic(topic, 'إعلان جديد بسوقنا', body);
  }
}
