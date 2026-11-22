# نشر المشروع على Oracle Cloud Always Free (مجاني دائم)

هاد دليل كامل لنشر الباك إند على سيرفر مجاني حقيقي (مش تجريبي بفترة محدودة)، بنفس فكرة
Docker اللي شغّلتها محلياً، بالإضافة لـ HTTPS تلقائي ومجاني عبر Caddy.

---

## 1) إنشاء الحساب والسيرفر

1. سجّل بـ [cloud.oracle.com](https://cloud.oracle.com). **سجّل بعنوان/بطاقة خارج سوريا** (مثلاً
   الإمارات) لتفادي أي مشاكل سياسات لاحقة - نفس النصيحة اللي حكيناها عن Firebase.
2. من القائمة: **Compute → Instances → Create Instance**
3. الاسم: أي اسم (مثلاً `souq-server`)
4. **Image:** اختر **Canonical Ubuntu 24.04**
5. **Shape:** اضغط Change Shape → اختر **Ampere (ARM) → VM.Standard.A1.Flex** (الأفضل: 2 OCPU
   / 12GB RAM ضمن الباقة المجانية). لو طلعلك "Out of Capacity"، جرّب منطقة (Region) تانية أو
   حاول بعد شوي - هاد مشكلة شائعة ومؤقتة بالمواصفات المجانية. البديل الاحتياطي: شكل
   `VM.Standard.E2.1.Micro` (AMD) دايماً متوفر بس أضعف بكتير.
6. حمّل مفتاح SSH (أو ولّد واحد جديد من نفس الصفحة واحفظه).
7. اضغط Create، وانتظر لحد ما تصير الحالة "Running".

## 2) فتح المنافذ (أهم خطوة بينسوها كتير)

لازم تفتح البورتات بمكانين، وإلا ما رح توصل للسيرفر من برا:

### أ) من كونسول أوراكل (Security List / NSG)
بصفحة الـ Instance ← Subnet ← Security List ← Add Ingress Rules:
- Source: `0.0.0.0/0` — Port: `80` (HTTP)
- Source: `0.0.0.0/0` — Port: `443` (HTTPS)
- (منفذ 22 SSH غالباً مفتوح افتراضياً، تأكد منه)

### ب) من داخل السيرفر نفسه (أوبونتو عندها جدار حماية خاص فيها كمان)
بعد ما تعمل SSH للسيرفر:
```bash
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save   # لو مثبت، وإلا:
sudo apt install -y iptables-persistent && sudo netfilter-persistent save
```

## 3) تثبيت Docker على السيرفر

```bash
ssh -i /path/to/your-key.pem ubuntu@<SERVER_PUBLIC_IP>

curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# اخرج وادخل تاني حتى تتفعّل الصلاحية:
exit
```

## 4) ارفع المشروع للسيرفر

من جهازك (مو من السيرفر):
```bash
scp -i /path/to/your-key.pem -r syria-souq-api ubuntu@<SERVER_PUBLIC_IP>:~/
```

## 5) جهّز ملف `.env` للإنتاج

على السيرفر:
```bash
ssh -i /path/to/your-key.pem ubuntu@<SERVER_PUBLIC_IP>
cd syria-souq-api
cp .env.production.example .env
nano .env
```
عدّل فيه:
- `POSTGRES_PASSWORD` و `DATABASE_URL` (نفس الباسوورد بالمكانين)
- `JWT_ACCESS_SECRET` و `JWT_REFRESH_SECRET` (ولّدهم بأمر: `openssl rand -hex 32`)
- `DOMAIN` — لو ما عندك دومين بعد، استخدم خدمة **nip.io** المجانية:
  لو الـ IP العام تبعك ظهر مثلاً `130.61.45.12`، اكتب:
  `DOMAIN=130-61-45-12.nip.io`
  (استبدل النقاط بشرطات) — هاد بيعطيك HTTPS فوري بدون شراء دومين.

## 6) شغّل كل شي

```bash
docker compose -f docker-compose.prod.yml up -d --build
```
أول مرة بتاخد شوي وقت (بناء الصورة + تحميل شهادة HTTPS تلقائياً من كادي).

> ملاحظة: خليت `ts-node` و`typescript` ضمن `dependencies` العادية (مش `devDependencies`) بقصد،
> حتى يضل أمر `npm run db:seed` شغّال حتى جوا صورة الإنتاج لو احتجته لاحقاً (مثلاً لتجربة أولية
> على السيرفر الحقيقي).

## 7) جهّز قاعدة البيانات

```bash
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
# اختياري بس مفيد للتجربة الأولى:
docker compose -f docker-compose.prod.yml exec api npm run db:seed
```

## 8) جرّبه

افتح بالمتصفح: `https://your-domain-or-ip.nip.io/api/categories`
لازم تشوف قائمة الأقسام (JSON) — معناها كل شي شغّال، مع HTTPS صحيح تلقائياً.

---

## تحديث تطبيق Flutter بعد النشر

بملف إعدادات الـ API بتطبيق Flutter (مثلاً `lib/config/api_config.dart` أو مكان الـ base URL)،
بدّل:
- `http://localhost:3000/api` ← `https://your-domain-or-ip.nip.io/api`
- رابط Socket.IO: `http://localhost:3000` ← `https://your-domain-or-ip.nip.io` (نفس الدومين،
  Caddy بيمرّر WebSocket تلقائياً بدون أي إعداد إضافي)

## تحديث مجموعة Postman

بدّل قيمة `baseUrl` بالمجموعة من `http://localhost:3000/api` لـ
`https://your-domain-or-ip.nip.io/api`.

---

## ملاحظات أمان مهمة قبل ما تعتبره "إنتاج حقيقي"

- غيّر كل الأسرار الافتراضية (`JWT_*_SECRET`, `POSTGRES_PASSWORD`) لقيم عشوائية قوية فعلاً.
- لا ترفع ملف `.env` (الحقيقي) لأي مكان عام (GitHub مثلاً).
- فعّل نسخ احتياطي دوري لقاعدة البيانات (`pg_dump`) - هاد جزء من "المرحلة 7: الإنتاج" اللي
  حكينا عنها بالخطة الأصلية، ولسا قدامنا.
- راقب استهلاك الموارد (RAM/CPU) من فترة لفترة - الباقة المجانية محدودة، ولو زاد الحمل كتير
  (نجاح كبير 🎉) بتحتاج تفكر بترقية أو توزيع أحمال.
