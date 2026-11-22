import { IsIn, IsString } from 'class-validator';

export class RegisterDeviceDto {
  @IsString()
  token: string;

  @IsIn(['android', 'ios'])
  platform: 'android' | 'ios';
}
