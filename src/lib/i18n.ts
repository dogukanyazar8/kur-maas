export type Language = "tr" | "en";

const tr = {
  carry: "Sonraki ayı hesapla",
  language: "Dil",
  numberFormat: "Sayı biçimi",
  calculator: "Hesaplayıcı",
  how: "Nasıl hesaplanır?",
  tagline: "Maaşına netlik kat.",
  eyebrow: "MAAŞ & KUR FARKI HESAPLAYICI",
  title: "Maaşının karşılığını bil.",
  intro:
    "Dolar maaşını, güncel maaş kurunu ve ödeme dönemini gir. Kur farkını ve toplam ödemeni tek bir hesapta gör.",
  private: "Maaş bilgin yalnızca sende.",
  privateDetail:
    "Hesaplama tarayıcında yapılır. Maaşın kaydedilmez, sunucuya gönderilmez.",
  formTitle: "Hesap bilgilerin",
  formSubtitle: "Birkaç bilgi. Şeffaf bir sonuç.",
  salary: "Aylık dolar maaşı",
  salaryHint: "Üç ay boyunca geçerli olan dolar maaşın.",
  currentRate: "Mevcut maaş kuru",
  rateHint:
    "Son kur farkı döneminden kalan, düşüşlere karşı korunan maaş kurun.",
  year: "Ödeme yılı",
  month: "Ödeme ayı",
  quarterly: "Kur farkı dönemi",
  ordinary: "Normal maaş dönemi",
  source: "Kur kaynağı",
  official: "TCMB verisi",
  scenario: "Senaryo",
  officialHint: "USD döviz alış · İlgili ayın son yayımlanan kuru",
  scenarioHint:
    "Mevcut TCMB kurları otomatik doldurulur. Devam eden ayın kuru geçicidir; istediğin değeri değiştirebilirsin.",
  scenarioAsOf: "TCMB verisi ·",
  scenarioEditable: "Kurları düzenleyerek farklı olasılıkları hesapla.",
  scenarioLoadError:
    "Bazı TCMB kurları alınamadı. Eksik değerleri girebilir veya Senaryo’ya tekrar basarak deneyebilirsin.",
  scenarioRateError: "Kur alınamadı",
  scenarioLoading: "Yükleniyor…",
  scenarioEdited: "Düzenlendi",
  scenarioPartial: "Geçici",
  scenarioComplete: "Ay sonu · TCMB",
  scenarioUnavailable: "Henüz veri yok",
  calculate: "Maaşımı hesapla",
  calculating: "TCMB kurları alınıyor…",
  reset: "Temizle",
  example: "Örneği dene",
  exampleHint: "1.000 USD · 43 TL kur · 44 / 45 / 46 TL senaryo",
  ordinaryHint:
    "Bu ay kur farkı ödenmez. Maaşın, girdiğin son korunmuş kur üzerinden hesaplanır.",
  result: "Hesap özeti",
  total: "Hesaplanan toplam ödeme",
  base: "Aylık maaş",
  adjustment: "3 aylık kur farkı",
  newRate: "Geçerli maaş kurun",
  difference: "Pozitif kur farkı",
  average: "3 aylık ortalama",
  futureRate:
    "Sonraki aya aktarırken kurun tüm hassasiyeti korunur. Gösterilen kısa değeri tekrar yazman gerekmez.",
  protected: "Mevcut kurunuz korundu",
  protectedHint:
    "Ortalama düştü; maaş kurun ve maaşın düşmedi. Ek kur farkı ödenmez.",
  rateRule: "Kur düşse de maaşın korunur.",
  emptyTitle: "Rakamlar yerini bulsun.",
  emptyHint: "Bilgilerini gir; maaşını ve kur farkını birlikte hesaplayalım.",
  emptyDetail: "Aylık maaş + 3 aylık kur farkı",
  print: "Yazdır",
  scenarioWarning:
    "Senaryo sonucu · Geçici veya düzenlenmiş kurlar içerebilir. Kullanılan değerleri aşağıda görebilirsin.",
  verified: "TCMB kaynağından",
  monthsTitle: "Hesabın arkasındaki kurlar",
  monthsHint:
    "Üç ayın son yayımlanan USD döviz alış kurları eşit ağırlıkla kullanılır.",
  referenceMonth: "Referans ay",
  lastDate: "Son yayın tarihi",
  buyingRate: "USD döviz alış",
  manualRate: "Senaryo kuru",
  notLoaded: "Hesaplamayla birlikte alınır",
  manual: "Kullanıcı girişi",
  referencePeriod: "Referans dönem",
  noRates: "Normal maaş ayında yeni kur ortalaması alınmaz.",
  errorNumber:
    "Pozitif bir tutar gir. Maaş 2, senaryo kurları 4 ondalık basamak içerebilir; mevcut maaş kurunun hassasiyeti korunur. Seçili sayı biçimini kontrol et.",
  errorPeriod: "2006–2100 arasında geçerli bir yıl ve ödeme ayı seç.",
  errorUpstream:
    "TCMB verisi şu anda alınamadı. Tekrar deneyebilir veya Senaryo seçeneğiyle kendi kurlarını girebilirsin.",
  errorIncomplete:
    "Bu dönemin üç referans ayı henüz tamamlanmadı. Kesin hesap için dönem sonunu bekle veya Senaryo kullan.",
  errorUnavailable:
    "Referans ayın son geçerli kuru doğrulanamadı. Daha eski bir kurla sonuç üretilmedi.",
  errorBusy: "Kur servisi şu anda yoğun. Biraz sonra tekrar dene.",
  rounding:
    "Tutarlar kuruşa yuvarlanır (yarım yukarı). Aylık maaş ve ek ödeme ayrı yuvarlanır; toplamları gösterilir.",
  scope:
    "Vergi, bordro kesintileri ve dönem içi maaş değişiklikleri bu hesaba dahil değildir.",
  howTitle: "Her adımı açık bir hesap.",
  howIntro:
    "Ocak, Nisan, Temmuz ve Ekim aylarında önceki üç ayın kurları dikkate alınır. Ocak hesabı önceki yılın Ekim–Aralık dönemini kullanır.",
  step1: "Üç ayın ortalaması",
  step1Body: "Her ayın son yayımlanan kurunu topla, üçe böl.",
  step2: "Maaş kurunu koru",
  step2Body:
    "Ortalama ve mevcut maaş kurundan yüksek olanı kullan. Düşüş maaşını azaltmaz.",
  step3: "Kur farkını ekle",
  step3Body:
    "Pozitif kur farkı × dolar maaşı × 3. Yeni kurla hesaplanan aylık maaşa ekle.",
  footer: "Kur değişir. Hesabın net kalır.",
  sourceLink: "TCMB kur arşivi",
  skip: "Hesaplayıcıya geç",
  precision: "Kur gösterimi 4 basamak; hesap tam hassasiyetle yapılır.",
  tryAgain: "Yeniden hesapla",
};

const en: Record<keyof typeof tr, string> = {
  carry: "Calculate next month",
  language: "Language",
  numberFormat: "Number format",
  calculator: "Calculator",
  how: "How it works",
  tagline: "Clarity for your salary.",
  eyebrow: "SALARY & EXCHANGE RATE CALCULATOR",
  title: "Know what your salary adds up to.",
  intro:
    "Enter your dollar salary, current salary rate and payment period. See your exchange adjustment and total payment in one clear calculation.",
  private: "Your salary stays yours.",
  privateDetail:
    "Calculated in your browser. Your salary is never stored or sent to the server.",
  formTitle: "Your calculation",
  formSubtitle: "A few details. A clear result.",
  salary: "Monthly dollar salary",
  salaryHint: "Your dollar salary throughout all three months.",
  currentRate: "Current salary rate",
  rateHint:
    "Your protected salary rate carried forward from the last adjustment period.",
  year: "Payment year",
  month: "Payment month",
  quarterly: "Adjustment period",
  ordinary: "Regular salary period",
  source: "Rate source",
  official: "CBRT data",
  scenario: "Scenario",
  officialHint: "USD buying · Last published rate of each reference month",
  scenarioHint:
    "Available CBRT rates fill automatically. The current month’s rate is provisional; you can edit any value.",
  scenarioAsOf: "CBRT data as of",
  scenarioEditable: "Edit rates to explore different outcomes.",
  scenarioLoadError:
    "Some CBRT rates could not be retrieved. Enter missing values or select Scenario again to retry.",
  scenarioRateError: "Rate unavailable",
  scenarioLoading: "Loading…",
  scenarioEdited: "Edited",
  scenarioPartial: "Provisional",
  scenarioComplete: "Month end · CBRT",
  scenarioUnavailable: "No data yet",
  calculate: "Calculate my salary",
  calculating: "Fetching CBRT rates…",
  reset: "Clear",
  example: "Try the example",
  exampleHint: "USD 1,000 · TRY 43 rate · 44 / 45 / 46 scenario",
  ordinaryHint:
    "No adjustment this month. Your salary uses the last protected rate you entered.",
  result: "Calculation summary",
  total: "Calculated total payment",
  base: "Monthly salary",
  adjustment: "3-month adjustment",
  newRate: "Your effective salary rate",
  difference: "Positive rate difference",
  average: "3-month average",
  futureRate:
    "Carry this rate to the next month without losing precision. There is no need to retype the shortened display value.",
  protected: "Your existing rate is protected",
  protectedHint:
    "The average fell, but your salary rate and salary did not. No extra adjustment is payable.",
  rateRule: "Your salary is protected when rates fall.",
  emptyTitle: "Let the numbers come together.",
  emptyHint: "Enter your details to see your salary and exchange adjustment.",
  emptyDetail: "Monthly salary + 3-month adjustment",
  print: "Print",
  scenarioWarning:
    "Scenario result · May include provisional or edited rates. Review the values used below.",
  verified: "From the CBRT source",
  monthsTitle: "The rates behind your salary",
  monthsHint:
    "The last published USD buying rate of each month carries equal weight.",
  referenceMonth: "Reference month",
  lastDate: "Last publication date",
  buyingRate: "USD buying rate",
  manualRate: "Scenario rate",
  notLoaded: "Fetched when you calculate",
  manual: "User input",
  referencePeriod: "Reference period",
  noRates: "Regular salary months do not establish a new average rate.",
  errorNumber:
    "Enter a positive amount. Salary allows 2 decimal places and scenario rates allow 4; protected salary rates retain their precision. Check your selected number format.",
  errorPeriod: "Select a valid month and a year between 2006 and 2100.",
  errorUpstream:
    "CBRT rates could not be retrieved. Try again, or choose Scenario to enter your own rates.",
  errorIncomplete:
    "The three reference months are not complete yet. Wait until the period ends or use Scenario.",
  errorUnavailable:
    "The last valid rate could not be verified. No result was produced from an older, unverified rate.",
  errorBusy: "The rate service is busy. Please try again shortly.",
  rounding:
    "Amounts round to cents (half up). Monthly salary and adjustment round separately; the total is their sum.",
  scope:
    "Taxes, payroll deductions and salary changes during the quarter are outside this calculation.",
  howTitle: "A calculation you can follow.",
  howIntro:
    "January, April, July and October use the preceding three months. January uses October–December of the previous year.",
  step1: "Average three months",
  step1Body:
    "Add the last published rate from each month, then divide by three.",
  step2: "Protect your salary rate",
  step2Body:
    "Use the higher of the average and your current salary rate. A decline never reduces your salary.",
  step3: "Add the adjustment",
  step3Body:
    "Positive rate difference × dollar salary × 3. Add this to the monthly salary calculated at the new rate.",
  footer: "Rates change. Your numbers stay clear.",
  sourceLink: "CBRT rate archive",
  skip: "Skip to calculator",
  precision:
    "Rates display 4 decimal places; calculations retain full precision.",
  tryAgain: "Recalculate",
};

export const translations = { tr, en };
export type Copy = typeof tr;
