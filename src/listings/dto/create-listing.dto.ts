import {
  IsInt,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateListingDto {
  @IsString()
  @MinLength(5)
  @MaxLength(100)
  title: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  description: string;

  @IsInt()
  @Min(500) // أقل سعر منطقي لإعلان (500 ل.س) لمنع إعلانات تجريبية فارغة
  priceSyp: number;

  @IsUUID()
  categoryId: string;

  @IsUUID()
  areaId: string;
}
