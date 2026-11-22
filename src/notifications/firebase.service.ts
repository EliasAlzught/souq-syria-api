import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app: App | null = null;
  private messaging: Messaging | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const projectId = this.config.get<string>('firebase.projectId');
    const clientEmail = this.config.get<string>('firebase.clientEmail');
    const privateKey = this.config.get<string>('firebase.privateKey');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn(
        '⚠️ Firebase غير مربوط (ناقص FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY بملف .env). ' +
          'إشعارات Push رح تُسجَّل باللوج فقط بدون إرسال فعلي.',
      );
      return;
    }

    this.app = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
    this.messaging = getMessaging(this.app);
    this.logger.log('✅ Firebase Admin SDK مربوط بنجاح');
  }

  private get isConfigured(): boolean {
    return this.messaging !== null;
  }

  /** إرسال إشعار لأجهزة مستخدم واحد محدد (قائمة توكنات) */
  async sendToTokens(tokens: string[], title: string, body: string) {
    if (!this.isConfigured || tokens.length === 0) return;
    try {
      await this.messaging!.sendEachForMulticast({
        tokens,
        notification: { title, body },
      });
    } catch (err) {
      this.logger.error(
        `فشل إرسال Push لأجهزة محددة: ${(err as Error).message}`,
      );
    }
  }

  /** اشتراك جهاز بـ topic (مثلاً "new_listings") ليستقبل الإشعارات العامة */
  async subscribeToTopic(token: string, topic: string) {
    if (!this.isConfigured) return;
    try {
      await this.messaging!.subscribeToTopic([token], topic);
    } catch (err) {
      this.logger.error(`فشل الاشتراك بالـ topic: ${(err as Error).message}`);
    }
  }

  /** إرسال إشعار لكل المشتركين بـ topic معيّن - يُستخدم لبث "إعلان جديد" لكل المستخدمين */
  async sendToTopic(topic: string, title: string, body: string) {
    if (!this.isConfigured) {
      this.logger.log(
        `[DEV] Broadcast to topic "${topic}": "${title}" - "${body}"`,
      );
      return;
    }
    try {
      await this.messaging!.send({ topic, notification: { title, body } });
    } catch (err) {
      this.logger.error(`فشل البث لـ topic: ${(err as Error).message}`);
    }
  }
}
