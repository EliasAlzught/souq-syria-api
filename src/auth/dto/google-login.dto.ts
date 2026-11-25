import { IsString } from 'class-validator';

export class GoogleLoginDto {
  // الـ idToken الراجع من Flutter (حزمة google_sign_in) بعد ما المستخدم يختار حسابه من جهازه
  @IsString()
  idToken: string;
}
