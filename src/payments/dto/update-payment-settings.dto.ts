import { IsString, MinLength } from 'class-validator';

export class UpdatePaymentSettingsDto {
  @IsString()
  @MinLength(5)
  shamCashPhone: string;

  @IsString()
  @MinLength(2)
  shamCashHolderName: string;
}
