import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomInt } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.googleClient = new OAuth2Client(
      this.config.get<string>('google.clientId'),
    );
  }

  /**
   * تسجيل الدخول الأساسي: Google Sign-In.
   * الـ idToken جاي من تطبيق Flutter (حزمة google_sign_in) بعد ما المستخدم يختار
   * حساب Google المسجّل أصلاً على جهازه. بنتحقق من التوكن مع Google مباشرة (ما
   * منثق بأي بيانات جايه من الموبايل بدون تحقق)، وبعدها ننشئ المستخدم أول مرة أو
   * نرجّع نفس الحساب الموجود حسب الإيميل.
   */
  async googleLogin(idToken: string): Promise<TokenPair & { userId: string }> {
    const clientId = this.config.get<string>('google.clientId');
    if (!clientId) {
      throw new BadRequestException(
        'تسجيل الدخول عبر Google غير مُفعّل على السيرفر (GOOGLE_CLIENT_ID ناقص)',
      );
    }

    let payload: {
      sub: string;
      email?: string;
      name?: string;
      picture?: string;
    };
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: clientId,
      });
      const data = ticket.getPayload();
      if (!data?.email) throw new Error('no email in token');
      payload = data;
    } catch {
      throw new UnauthorizedException('توكن Google غير صالح');
    }

    const user = await this.prisma.user.upsert({
      where: { email: payload.email! },
      update: {
        googleId: payload.sub,
        // لا نستبدل اسم/صورة وضعهم المستخدم يدوياً لاحقاً بقيمة فاضية من Google
        name: payload.name,
        avatarUrl: payload.picture,
      },
      create: {
        email: payload.email!,
        googleId: payload.sub,
        name: payload.name,
        avatarUrl: payload.picture,
      },
    });

    const tokens = await this.issueTokenPair(user.id, user.role);
    return { ...tokens, userId: user.id };
  }

  /**
   * طلب رمز تحقق (OTP) لرقم هاتف - تُستخدم حالياً لتوثيق رقم هاتف مستخدم
   * مسجّل دخول أصلاً عبر Google (راجع verifyPhoneOtp بالأسفل).
   * TODO: استبدال الـ console.log بربط فعلي ببوابة SMS (محلية سورية أو Twilio)
   * عند الإنتاج. حالياً الكود يُطبع باللوج فقط لتسهيل الاختبار.
   */
  async requestOtp(
    phone: string,
  ): Promise<{ message: string; devCode?: string }> {
    const code = this.generateNumericCode(6);
    const codeHash = await bcrypt.hash(code, 10);
    const expiresMinutes = this.config.get<number>('otp.expiresMinutes', 5);

    await this.prisma.otpCode.create({
      data: {
        phone,
        codeHash,
        expiresAt: new Date(Date.now() + expiresMinutes * 60 * 1000),
      },
    });

    const isDev = this.config.get('nodeEnv') !== 'production';
    if (isDev) {
      // بالتطوير فقط: نطبع الكود باللوج (ما في بوابة SMS حقيقية مربوطة بعد)
      this.logger.warn(`[DEV ONLY] OTP for ${phone}: ${code}`);
    }

    return {
      message: 'تم إرسال رمز التحقق',
      ...(isDev ? { devCode: code } : {}),
    };
  }

  /**
   * توثيق رقم هاتف المستخدم المسجّل دخول أصلاً (عبر Google). بعكس تسجيل الدخول
   * القديم بالـ OTP، هون ما منعمل upsert لحساب جديد - منلزق الرقم بنفس حساب
   * المستخدم الحالي (userId جاي من الـ JWT عبر JwtAuthGuard بالكنترولر).
   */
  async verifyPhoneOtp(
    userId: string,
    phone: string,
    code: string,
  ): Promise<{ message: string }> {
    const maxAttempts = this.config.get<number>('otp.maxAttempts', 5);

    const otp = await this.prisma.otpCode.findFirst({
      where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw new BadRequestException('رمز التحقق غير صالح أو منتهي الصلاحية');
    }

    if (otp.attempts >= maxAttempts) {
      throw new BadRequestException(
        'تجاوزت عدد المحاولات المسموحة، اطلب رمزاً جديداً',
      );
    }

    const isValid = await bcrypt.compare(code, otp.codeHash);

    if (!isValid) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('رمز التحقق غير صحيح');
    }

    // تأكد إنه الرقم مش مرتبط أصلاً بحساب تاني (phone عمود @unique بقاعدة البيانات)
    const existingOwner = await this.prisma.user.findUnique({
      where: { phone },
    });
    if (existingOwner && existingOwner.id !== userId) {
      throw new BadRequestException(
        'رقم الهاتف هذا موثّق أصلاً على حساب آخر',
      );
    }

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { phone, isPhoneVerified: true },
    });

    return { message: 'تم توثيق رقم الهاتف بنجاح' };
  }

  /**
   * تدوير رمز التحديث (Refresh Token Rotation): يُبطل القديم ويصدر زوجاً جديداً.
   */
  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: { sub: string; role: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('رمز التحديث غير صالح');
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('رمز التحديث غير صالح أو منتهي');
    }

    // إبطال الرمز القديم فوراً (rotation) لمنع إعادة استخدامه
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokenPair(payload.sub, payload.role as any);
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { userId, tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ---------- دوال مساعدة داخلية ----------

  private async issueTokenPair(
    userId: string,
    role: string,
  ): Promise<TokenPair> {
    const payload = { sub: userId, role };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: this.config.get<string>('jwt.accessExpiresIn'),
    });

    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('jwt.refreshSecret'),
      expiresIn: this.config.get<string>('jwt.refreshExpiresIn'),
    });

    const refreshExpiresIn = this.config.get<string>(
      'jwt.refreshExpiresIn',
      '30d',
    );
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(
          Date.now() + this.parseDurationMs(refreshExpiresIn),
        ),
      },
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    // هاش سريع (SHA-256) كافٍ هون لأن الرمز نفسه عشوائي وموقّع، الهدف منع تخزينه كنص صريح بقاعدة البيانات
    return createHash('sha256').update(token).digest('hex');
  }

  private generateNumericCode(length: number): string {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return randomInt(min, max).toString();
  }

  private parseDurationMs(duration: string): number {
    const match = /^(\d+)([smhd])$/.exec(duration);
    if (!match) return 30 * 24 * 60 * 60 * 1000; // افتراضي 30 يوم
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const unitMs = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit]!;
    return value * unitMs;
  }
}
