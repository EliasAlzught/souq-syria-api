import { IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

export class SendMessageDto {
  @IsUUID()
  conversationId: string;

  @ValidateIf((o) => !o.imageUrl)
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}
