import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateReportDto {
  @IsOptional()
  @IsUUID()
  listingId?: string;

  @IsString()
  @MinLength(5)
  reason: string;
}
