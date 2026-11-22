import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentPurpose, PaymentRequestStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ListingsService } from '../listings/listings.service';
import { UpdatePaymentSettingsDto } from './dto/update-payment-settings.dto';

const SETTINGS_ID = 'singleton';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly listingsService: ListingsService,
  ) {}

  // ---------- عامة (بدون تسجيل دخول) ----------

  async getSettings() {
    const settings = await this.prisma.paymentSettings.findUnique({
      where: { id: SETTINGS_ID },
    });
    if (!settings) {
      throw new NotFoundException(
        'الأدمن لسا ما حدّد معلومات استلام الدفع عبر شام كاش',
      );
    }
    return settings;
  }

  async getActivePackages() {
    return this.prisma.package.findMany({
      where: { isActive: true },
      orderBy: { listingsCount: 'asc' },
    });
  }

  // ---------- المستخدم ----------

  async getMyPaymentRequests(userId: string) {
    return this.prisma.paymentRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        package: true,
        listing: { select: { id: true, title: true } },
      },
    });
  }

  async purchasePackage(userId: string, packageId: string) {
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
    });
    if (!pkg || !pkg.isActive) throw new NotFoundException('الباقة غير متوفرة');

    const paymentRequest = await this.prisma.paymentRequest.create({
      data: {
        userId,
        purpose: PaymentPurpose.PACKAGE,
        amountSyp: pkg.priceSyp,
        packageId: pkg.id,
      },
    });

    const settings = await this.prisma.paymentSettings
      .findUnique({ where: { id: SETTINGS_ID } })
      .catch(() => null);

    return { paymentRequest, package: pkg, paymentSettings: settings };
  }

  async addNote(id: string, userId: string, senderNote: string) {
    const req = await this.prisma.paymentRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('طلب الدفع غير موجود');
    if (req.userId !== userId) {
      throw new ForbiddenException('لا تملك صلاحية على هذا الطلب');
    }
    if (req.status !== PaymentRequestStatus.PENDING) {
      throw new BadRequestException('هذا الطلب تمت معالجته مسبقاً');
    }
    return this.prisma.paymentRequest.update({
      where: { id },
      data: { senderNote },
    });
  }

  // ---------- الأدمن ----------

  async getPendingForAdmin() {
    return this.prisma.paymentRequest.findMany({
      where: { status: PaymentRequestStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        listing: { select: { id: true, title: true, priceSyp: true } },
        package: true,
      },
    });
  }

  /**
   * الأدمن بيتأكد يدوياً من داخل تطبيق شام كاش إنه المبلغ وصل فعلياً، وبعدين يستدعي هاد الإندبوينت.
   * - لو الطلب لإعلان واحد: الإعلان بيطلع من AWAITING_PAYMENT لـ PENDING (يدخل مراجعة المحتوى العادية).
   * - لو الطلب لباقة: بيضاف رصيد الباقة فوراً لحساب المستخدم.
   */
  async confirm(id: string, adminId: string) {
    const req = await this.prisma.paymentRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('طلب الدفع غير موجود');
    if (req.status !== PaymentRequestStatus.PENDING) {
      throw new BadRequestException('هذا الطلب تمت معالجته مسبقاً');
    }

    if (req.purpose === PaymentPurpose.LISTING && req.listingId) {
      await this.listingsService.activateAfterPayment(req.listingId);
      await this.notifications.notify(
        req.userId,
        'تم تأكيد الدفع',
        'إعلانك دخل الآن لمراجعة المحتوى من فريقنا',
      );
    } else if (req.purpose === PaymentPurpose.PACKAGE && req.packageId) {
      const pkg = await this.prisma.package.findUniqueOrThrow({
        where: { id: req.packageId },
      });
      await this.prisma.user.update({
        where: { id: req.userId },
        data: { packageListingsRemaining: { increment: pkg.listingsCount } },
      });
      await this.notifications.notify(
        req.userId,
        'تم تفعيل باقتك',
        `أضفنالك ${pkg.listingsCount} إعلان لحسابك`,
      );
    }

    return this.prisma.paymentRequest.update({
      where: { id },
      data: {
        status: PaymentRequestStatus.CONFIRMED,
        reviewedAt: new Date(),
        reviewedByAdminId: adminId,
      },
    });
  }

  async reject(id: string, adminId: string, reason?: string) {
    const req = await this.prisma.paymentRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('طلب الدفع غير موجود');
    if (req.status !== PaymentRequestStatus.PENDING) {
      throw new BadRequestException('هذا الطلب تمت معالجته مسبقاً');
    }

    if (req.purpose === PaymentPurpose.LISTING && req.listingId) {
      await this.listingsService.rejectAfterPaymentFailure(req.listingId);
    }

    await this.notifications.notify(
      req.userId,
      'تم رفض طلب الدفع',
      reason ?? 'ما قدرنا نتأكد من وصول المبلغ، تواصل معنا لو عندك استفسار',
    );

    return this.prisma.paymentRequest.update({
      where: { id },
      data: {
        status: PaymentRequestStatus.REJECTED,
        reviewedAt: new Date(),
        reviewedByAdminId: adminId,
      },
    });
  }

  async updateSettings(dto: UpdatePaymentSettingsDto) {
    return this.prisma.paymentSettings.upsert({
      where: { id: SETTINGS_ID },
      update: dto,
      create: { id: SETTINGS_ID, ...dto },
    });
  }

  async updateQrImage(qrImageUrl: string) {
    return this.prisma.paymentSettings.upsert({
      where: { id: SETTINGS_ID },
      update: { qrImageUrl },
      create: {
        id: SETTINGS_ID,
        shamCashPhone: '',
        shamCashHolderName: '',
        qrImageUrl,
      },
    });
  }
}
