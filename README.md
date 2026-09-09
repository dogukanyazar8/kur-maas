# Kur Maaş

TCMB USD döviz alış kurlarıyla aylık maaş ve üç aylık kur farkı hesaplayıcısı. Türkçe/İngilizce arayüz; ayrı TR, US, DE, FR sayı biçimleri. Maaş ve girilen kurlar tarayıcıda kalır; sunucuya yalnız yıl ve ödeme ayı gönderilir. Kişisel veri depolanmaz.

## Çalıştırma

Node **24.20.0 LTS** ve npm gerekir. Bu çalışma alanında doğrulanmış taşınabilir Node `.runtime/node-v24.20.0-win-x64` içinde bulunur; sistem Node sürümünü değiştirmez. Node arşivinin SHA-256 değeri resmî `SHASUMS256.txt` ile doğrulanmıştır.

Windows, bu klasörde:

```powershell
.\dev.cmd
```

Tarayıcı: http://127.0.0.1:3000

Başka bilgisayarda, Node 24.20.0 kurulduktan sonra:

```sh
npm ci
npm run dev
```

Üretim derlemesi:

```sh
npm run build
npm start
```

Yerel sunucu yalnız `127.0.0.1` adresini dinler. TCMB dış erişimi dışında API anahtarı veya veritabanı gerekmez.

## Railway'e yayınlama

Depo: [dogukanyazar8/kur-maas](https://github.com/dogukanyazar8/kur-maas), ana dal `main`.

1. Railway'de **New Project → Deploy from GitHub repo** seç; `kur-maas` deposunu bağla. GitHub erişiminde yalnız bu depoyu seçebilirsin.
2. Kaynak dalı `main`, kök dizini `/` olarak bırak. `railway.json` otomatik olarak Railpack, `npm run build`, `npm run start:railway` ve `/` sağlık kontrolünü ayarlar.
3. Başarılı deploy sonrası **Settings → Networking → Generate Domain** ile HTTPS adresi oluştur.

`start:railway`, `0.0.0.0` üzerinde dinler; Next.js portu Railway'in `PORT` değişkeninden alır. Node sürümü `.nvmrc` ile **24.20.0** olarak belirlenmiştir. Mevcut uygulama için ek secret, veritabanı, volume veya migration gerekmez. `/` sağlık kontrolü sayfanın çalıştığını doğrular; TCMB erişimi ayrıca gerçek bir hesapla kontrol edilmelidir.

Yerel `npm start` loopback üzerinde kalır. Railway komutunu yerelde çalıştırmak uygulamayı bilgisayarın diğer ağ arayüzlerine de açar. Depoya `.runtime`, `.next`, `node_modules`, ortam dosyaları ve test çıktıları gönderilmez. `npm run typecheck`, temiz checkout'ta gereken Next.js türlerini önce üretir.

[Railway yapılandırma referansı](https://docs.railway.com/config-as-code/reference) · [Ağ ve port ayarları](https://docs.railway.com/guides/vibe-coding-deploy)

## Kesinleşen maaş politikası

`S`: aylık dolar maaşı; `B`: son kur farkı döneminden kalan korunmuş maaş kuru. Üç ay boyunca aynı dolar maaşı kullanılır.

```text
A = (ay1 son yayımlanan kur + ay2 son yayımlanan kur + ay3 son yayımlanan kur) / 3
E = max(A, B)
D = max(A − B, 0)
Aylık maaş = S × E
Kur farkı = 3 × S × D
Toplam = aylık maaş + kur farkı
```

`1000 USD`, mevcut kur `43`, ay sonu kurları `44/45/46`: aylık maaş **45.000 TL**, ek ödeme **6.000 TL**, toplam **51.000 TL**. Ortalama düşerse mevcut maaş kuru korunur; negatif fark tahsil edilmez.

| Ödeme | Referans aylar |
| --- | --- |
| Ocak | Önceki yıl Ekim–Aralık |
| Nisan | Ocak–Mart |
| Temmuz | Nisan–Haziran |
| Ekim | Temmuz–Eylül |

Normal aylarda girilen son korunmuş kur kullanılır. Kur farkı hesabından sonra **Sonraki ayı hesapla** düğmesi, kuru ekranda kısaltılmış dört basamaklı değerden kopyalamadan hassasiyetiyle taşır. Uygulama geçmiş dönemleri otomatik bir bordro kaydı olarak saklamaz; yeni oturumda geçerli korunmuş kur kullanıcı tarafından girilir.

Ara hesaplar 100 anlamlı basamaklı decimal aritmetik kullanır. Devreden kur en çok 50 ondalık basamakla taşınır; TCMB/senaryo kaynak kurları en çok 4, maaş en çok 2 basamak kabul eder. Aylık maaş ve ek ödeme ayrı ayrı **ROUND_HALF_UP** ile kuruşa yuvarlanır, toplam bu iki tutarın toplamıdır. Sınırlar: dolar maaşı en çok 1 milyar USD; kur en çok 1 milyon TL/USD. Kur görüntüsü 4 ondalık basamaktır ve hesapta tekrar kullanılmaz.

Vergi/SGK, bordro kesintileri, eksik çalışma ayları ve dönem içi maaş değişiklikleri kapsam dışı. Bu hesap net/brüt dönüşümü yapmaz; girilen tutarı aynı esasla hesaplar. Yuvarlama politikası şirket bordrosuyla karşılaştırılmalıdır.

## Veri doğruluğu ve güvenlik

- Kaynak: [TCMB kur arşivi](https://www.tcmb.gov.tr/kurlar/kurlar_tr.html), sabit `https://www.tcmb.gov.tr/kurlar/YYYYMM/DDMMYYYY.xml` adresleri, yalnız USD `ForexBuying`.
- Desteklenen ödeme yılları **2006–2100**. Böylece eski TL dönemindeki veriler güncel TL ile karışmaz. Resmî mod yalnız üç referans ayı da tamamlanmış dönemleri hesaplar; gelecek normal aylar senaryo olarak etiketlenir.
- Her ayın son yayımlanan günü bulunur. Hafta sonları atlanır; yalnız HTTP 404 önceki güne geçilmesine izin verir. En çok aynı ay içinde 10 iş günü aranır. 429/5xx/timeout/XML hatasında eski kurla sonuç üretilmez.
- TCMB UTF-8 ve eski ISO-8859-9 XML belgeleri desteklenir. Kur, USD birimi, tarih ve XML yapısı doğrulanır; DTD/entity bildirimleri reddedilir.
- Sabit HTTPS hedefi, yönlendirme yasağı, istek başına 8 saniye/ay başına 24 saniye zaman sınırı, 256 KiB belge sınırı, en çok 6 aktif ay sorgusu, 96 kayıt/24 saat önbellek. Tekrarlanan sorgular birleştirilir. Önbellek süreç başınadır; çok örnekli hostingde paylaşılan kota sağlamaz.
- Senaryo seçilince `/api/scenario-rates` seçilen dönemin mevcut TCMB kurlarını doldurur. Tamamlanan ay için ayın son yayını; devam eden ay için İstanbul'da sorgu tarihine kadarki son yayın kullanılır ve **Geçici** yazılır. Gelecek aylar boş kalır. Yayın tarihleri ve kaynak bağlantıları hesaplamadan önce de gösterilir. Güncel ay önbelleği en çok 60 saniyedir; HTTP yanıtları `no-store` kullanır.
- Kullanıcının düzenlediği senaryo alanı **Düzenlendi** olarak işaretlenir; geç dönen istek bu değeri ezmez. Dönem değişince eski alanlar/istekler temizlenir. Bir ay alınamazsa diğer mevcut kurlar korunur, eksikler elle girilebilir. Örnek düğmesi sabit ve açıkça etiketlenmiş 44/45/46 senaryosudur.
- Dil, sayı biçimi ve ödeme ayı seçimleri ortak Radix Select bileşenini kullanır. Açılan menüde klavye gezinmesi, seçili öğe, odak dönüşü ve ekran kenarına göre konumlandırma desteklenir. Textbox hover ve focus çerçeveleri tek dış halka kullanır.
- Dil ve sayı biçimi bağımsızdır. Yanlış gruplama ve fazla ondalık sessizce düzeltilmez. Bölge değişimi geçerli sayıları korur; çözümlenemeyen girişleri temizler.
- Tarihler cihaz saat diliminden bağımsız; dönem tamamlanması İstanbul takvimine göre. İlk etkileşim hydration tamamlanana kadar kapalı, formda maaş bilgisi gönderecek `name` alanları yok.
- Maaş localStorage, cookie, analytics veya API'ye yazılmaz. Dış font/izleyici kullanılmaz. CSP nonce, frame yasağı, no-referrer, nosniff ve kapalı kamera/mikrofon/konum izinleri bulunur.

## Teknoloji sürümleri

8 Eylül 2026'da npm kaynağından doğrulanan kararlı sürümler: Next.js **16.3.4**, React **19.2.8**, decimal.js **10.6.0**, fast-xml-parser **5.11.1**, Vitest **5.0.0**, Playwright **1.63.0**, ESLint **10.10.0**. TypeScript **6.0.3**, güncel typescript-eslint **8.70.0** tarafından desteklenen en yeni kararlı sürümdür; TypeScript 7 henüz bu araç tarafından desteklenmediği için kullanılmadı. Sürümler tam sabitlenir ve `package-lock.json` depoya dahildir.

Next.js hazır ESLint yapılandırmasının eski ESLint 9 isteyen eklentileri yerine güncel Next.js, React Hooks ve TypeScript ESLint kuralları doğrudan kullanılır. Erişilebilirlik ayrıca axe ile gerçek tarayıcı testlerine dahildir.

## Doğrulama komutları

Node 24.20.0 ile:

```sh
npm test
npm run typecheck
npm run lint
npm run build
npx playwright install chromium firefox webkit
npm run test:e2e
npm audit
```

Playwright üretim derlemesini `127.0.0.1:3100` üzerinde kendisi başlatıp kapatır. Bu port boş olmalı. Chromium/TR/İstanbul, Firefox/US/Los Angeles, WebKit/DE/Auckland ve mobil WebKit/FR/Paris testleri bulunur. Mobil emülasyon, fiziksel iPhone doğrulaması değildir.

Deterministik tarayıcı testleri TCMB ağ sınırında açıkça tanımlanmış yanıtlar kullanır; aynı form, API sözleşmesi ve gerçek hesap motoru çalışır. Canlı TCMB kontrolü ayrı kanıttır. Test raporu `playwright-report/`, görsel çıktılar `output/playwright/` altında üretilir.

Kaynak organizasyonu: `src/lib/calculator.ts` hesap; `numbers.ts` sayı biçimi; `periods.ts` takvim; `tcmb.ts` dış veri; `src/app/api/rates/route.ts` HTTP sınırı; `src/components/` arayüz. Tasarım ve kapsam `docs/design.md` içinde.

## Doğrulama sonucu — 8 Eylül 2026

- 145 birim/entegrasyon testi PASS.
- 64 üretim derlemesi üzerinde tarayıcı testi PASS (4 tarayıcı/bölge projesi); kapalı menüyle sayfa ve açık listbox kapsamlarında axe ihlali 0. Açık menü odağı ve klavye davranışları ayrıca test edilir.
- Lint, TypeScript kontrolü ve üretim derlemesi PASS; npm bağımlılık ağacında uyumsuzluk yok.
- npm audit: 0 bilinen güvenlik açığı.
- Canlı `/api/rates?year=2026&month=7`: 44.9692 / 45.6312 / 46.5747; 1000 USD ve 43 TL için 53900.13 TL. Tarihler 30 Nisan / 25 Mayıs / 30 Haziran.
- Canlı `/api/scenario-rates?year=2026&month=10`: 31 Temmuz **47.3452**, 31 Ağustos **48.1745**, 8 Eylül **48.3727**; Eylül `partial`, yanıt `no-store`. 2027 Ocak sorgusunda gelecekteki üç referans ay `unavailable`, değerler boş.
- Tarihsel ISO-8859-9 verisiyle 2016 Ocak ve 2006 Ocak kontrolleri PASS.
- Üretim HTTP yanıtında CSP nonce ve yıl/dönem hata sınırları doğrulandı.
- Bağımsız inceleme sonrası açık engelleyici bulgu kalmadı. Fiziksel cihaz ve canlı hosting doğrulaması yapılmadı.

## GitHub / Railway hazırlığı — 9 Eylül 2026

- `npm run check`: lint, temiz checkout için tür üretimi, TypeScript, 145 birim/entegrasyon testi ve üretim derlemesi PASS.
- 64 tarayıcı testi PASS; devreden kurun dört basamaklı görünümü, tam hassasiyetle yeniden hesaplama ve sayı biçimi değişimi dahil.
- `npm audit`: 0 bilinen açık; bağımlılık ağacı tutarlı.
- Railway başlangıç komutu yerelde `PORT=3101` ile `0.0.0.0` üzerinde doğrulandı. `/` HTTP 200, CSP nonce mevcut; test sunucusu kapatıldı.
- Canlı Railway deploy ve temiz Linux kurulumu henüz doğrulanmadı. Önceki bölümdeki canlı TCMB değerleri 8 Eylül kontrolüne aittir.
