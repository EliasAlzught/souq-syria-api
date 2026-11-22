import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors(); // بالإنتاج: قيّد origin حسب نطاق تطبيق الموبايل/لوحة التحكم

  // تقديم الصور المرفوعة محلياً كملفات ثابتة: /uploads/listings/xxx.jpg
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // يحذف أي حقل غير معرّف بالـ DTO
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`🚀 Souq Al-Hay API running on http://localhost:${port}/api`);
}
bootstrap();
