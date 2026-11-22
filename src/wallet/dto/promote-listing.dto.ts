import { IsIn, IsUUID } from 'class-validator';

export class PromoteListingDto {
  @IsUUID()
  listingId: string;

  // باقات الترقية البسيطة المتاحة حالياً (أيام الظهور بالأعلى)
  @IsIn([3, 7, 14])
  days: 3 | 7 | 14;
}
