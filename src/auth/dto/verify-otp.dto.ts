import { IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @Matches(/^\+963\d{9}$/, {
    message: 'رقم الهاتف يجب أن يكون بصيغة +963xxxxxxxxx',
  })
  phone: string;

  @IsString()
  @Length(4, 6)
  code: string;
}
