import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';

/**
 * تخزين محلي بسيط للصور أثناء التطوير (مجلد uploads/listings).
 * TODO بالإنتاج: استبدال هاد بتخزين سحابي (S3-compatible) بدل القرص المحلي،
 * لأن القرص المحلي بينمسح لو السيرفر انعمله إعادة نشر (redeploy) على بعض المنصات.
 */
export const listingImageStorage = diskStorage({
  destination: './uploads/listings',
  filename: (_req, file, callback) => {
    const uniqueName = `${randomUUID()}${extname(file.originalname)}`;
    callback(null, uniqueName);
  },
});

export const imageFileFilter = (
  _req: unknown,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (!file.mimetype.match(/^image\/(jpg|jpeg|png|webp)$/)) {
    return callback(
      new Error('فقط ملفات الصور مسموحة (jpg, png, webp)'),
      false,
    );
  }
  callback(null, true);
};
