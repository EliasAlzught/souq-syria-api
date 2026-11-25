import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { GoogleLoginDto } from './dto/google-login.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** تسجيل الدخول/إنشاء الحساب عبر Google (الطريقة الأساسية الوحيدة حالياً) */
  @Post('google')
  @HttpCode(HttpStatus.OK)
  googleLogin(@Body() dto: GoogleLoginDto) {
    return this.authService.googleLogin(dto.idToken);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@CurrentUser('sub') userId: string, @Body() dto: RefreshTokenDto) {
    return this.authService.logout(userId, dto.refreshToken);
  }

  // ---------- توثيق رقم الهاتف (لمستخدم مسجّل دخول أصلاً عبر Google) ----------
  // ملاحظة: هاي المسارات جاهزة بالباك إند من الآن، بس شاشتها بتطبيق Flutter
  // رح تُبنى لاحقاً حسب كلامك.

  @UseGuards(JwtAuthGuard)
  @Post('phone/request-otp')
  @HttpCode(HttpStatus.OK)
  requestPhoneOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto.phone);
  }

  @UseGuards(JwtAuthGuard)
  @Post('phone/verify-otp')
  @HttpCode(HttpStatus.OK)
  verifyPhoneOtp(
    @CurrentUser('sub') userId: string,
    @Body() dto: VerifyOtpDto,
  ) {
    return this.authService.verifyPhoneOtp(userId, dto.phone, dto.code);
  }
}
