# Mars’a İlk Koloni

**NASA Space Apps 2026 · Sivas**

Dünya’dan kalk, üç astronotu Mars’a ulaştır ve Jezero Krateri’nde ilk koloniyi kur. Uçuş bölümünde yörünge, yakıt ve erzak yönetimini; yüzey bölümünde modül yerleşimini, ekip görevlerini, yaşam desteğini ve toz fırtınalarını aynı görev akışında deneyimlersin. Arayüz Türkçedir.

## Çalıştırma

Node.js ve npm kurulu olmalıdır. Proje Vite + Three.js, JavaScript ES modülleri ve Vitest kullanır.

```powershell
npm install
npm run dev
```

Terminalde gösterilen yerel adresi aç. Ana menü `index.html`, uçuş `flight.html`, yüzey bölümü `colony.html` üzerinden açılır. **Yeni Oyun** ile astronot ve bölüm seçilir.

```powershell
npm test
npm run build
npm run preview
```

Model, doku ve yazı tipleri yereldir; bağımlılıklar kurulduktan sonra demo internet bağlantısı gerektirmez. Bilimsel kaynak bağlantıları için internet gerekir.

## Bölüm 1 — Dünya’dan kalkış

**Göreve Başla** ile T−10 geri sayımını başlat. Varsayılan otopilot kalkışı ve güvenli kademe ayrılmalarını yönetir. Dünya park yörüngesinde **B** ile Mars transferini başlat; seyirde zaman hızını artır. Mars yakalaması otomatik gerçekleşir. Mars park yörüngesinde tekrar **B** ile yörüngeden çıkış ve iniş başlar.

Güvenli temastan sonra oyun, kalan iniş yükünü aynı sekmenin `sessionStorage` alanına kaydedip koloniyi otomatik açar. Doğrudan koloni sayfasına girmek örnek iniş yükünü kullanır; üst çubuk veri kaynağını gösterir.

| Kontrol | İşlev |
|---|---|
| Boşluk / E | Geri sayım; uçuşta güvenli kademe atımı komutu |
| B | Dünya park yörüngesinde Mars transferi; Mars yörüngesinde iniş manevrası |
| 1 / 2 / 3 / 4 / 5 / 6 | Takip / kabin / yer takibi / motor / sinematik / harita kamerası |
| C | Sıradaki kamera |
| Fare sürükleme / tekerlek | Takip kamerasını döndürme / yakınlaştırma |
| , / . | Zamanı yavaşlatma / hızlandırma |
| T | Zaman hızını artırma |
| A | Manuel gaz kolunu açma / kapatma |
| Shift / Ctrl | Manuel gazı artırma / azaltma |
| Z / X | Manuel gaz tam / kes |
| Esc / P | Duraklatma ve ayarlar menüsü |
| H | Kontrol yardımı |
| Q | Uçuş kol bilgisayarı |
| M | Sesi kapatma / açma |
| F | Tam ekran |

Manuel gaz kalkış, transfer ve yakalama yanışlarında kullanılabilir. SRB ve Mars iniş gazı otopilottadır. Motor yanarken veya atmosfer içindeyken zaman hızının üst sınırı 10×’dır; yüksek hızlar güvenli seyirde açılır.

## Bölüm 2 — Mars kolonisi

Tam ekran yüzey sahnesindeki sol menüden **Kaynaklar**, **Mürettebat**, **Modüller**, **Atölye / tarım** ve **Görev raporu** çekmecelerini aç. **Görünüm / yardım**, astronot seçimi, üs planı, model yükleme ve rover kontrollerini içerir. Bir çekmeceyi aynı düğmeyle, × veya Esc ile kapatabilirsin.

1. Mürettebatın görevlerini ata ve modül envanterinden bir modül seç.
2. Çekmeceyi kapat; uygun zemine veya desteklenen çatıya yerleştir. İnşaat ve üretim için ekip görevleri önemlidir.
3. Kaynaklar panelinde yaşam desteği önceliğini belirle ve **Bir sol ilerlet** düğmesine bas.
4. Ekip görevlerini sonraki sol için yeniden düzenle. Serada yetiştir ve hasat yap.
5. On sollük görevin sonunda raporu incele ve sonuç JSON’unu indir. Üç astronot hayatta kalmalı; son üç solun her birinde temel ihtiyaçlar karşılanmalıdır.

| Kontrol | İşlev |
|---|---|
| Sahneye tıklama | Astronot görünümünde fare kilidi; kilitliyken etkileşim |
| W / A / S / D | Yürüme |
| Fare / yön tuşları | Astronotun bakışını döndürme |
| E | Hedefteki modülü yerleştirme, hava kilidi, hasat |
| R | Yaşam modülüne bakarken çatıya erişme / geri dönme |
| Esc | Açık paneli kapatma; astronot görünümünden üs planına dönme / fare kilidini bırakma |
| Üs planında fare sürükleme / tekerlek | Kamerayı döndürme / yakınlaştırma |
| Üs planında tıklama | Seçili modülü yerleştirme veya hedefle etkileşim |
| Alt / Q | Kol terminali (KOL entegrasyonu) |
| L | Kafa lambası (YÜZEY entegrasyonu) |
| [ / ] | Yüzey zaman hızını azaltma / artırma (YÜZEY entegrasyonu) |

Kol terminali, kafa lambası ve yüzey zaman hızı diğer çalışanların entegrasyon sözleşmesidir. Kaynaklar ve ekip hesapları **Bir sol ilerlet** ile ilerler. Fare kilitliyken yönetim çekmeceleri sahne tıklamalarını yakalamaz. Küçük ekranlarda paneller menünün altında dikey yerleşir; masaüstü klavye/fareyle oynanış hedeflenir.

## Bilimsel temel

Uçuş fiziği SI birimleriyle çalışan, DOM ve Three.js içermeyen deterministik bir çekirdektir. Sabit adımda kuvvet integrasyonu, Newton/Kepler yörüngeleri, Hohmann transferi, roket denklemi, yakıt ve yaşam desteği muhasebesi, kuvvet tabanlı Mars girişi ve motorlu iniş bulunur. Yüksek hızda seyir analitik Kepler çözümüyle ilerler.

- [Fizik modeli, kaynaklar ve sınırlar](docs/PHYSICS.md): NASA/JPL gezegen sabitleri, US Standard Atmosphere 1976, NASA Glenn Mars atmosferi, SLS/Orion referansları ve görev varsayımları.
- [NASA Ames · Yaşam desteği, Tablo 1](https://ntrs.nasa.gov/citations/20160005782): kişi başına Dünya gününde 0,84 kg oksijen, 3,52 kg içme/yemek hazırlama suyu, 0,62 kg kuru gıda.
- [NASA/JPL MOXIE, 2023](https://www.nasa.gov/solar-system/nasas-oxygen-generating-experiment-moxie-completes-mars-mission/): Perseverance üzerindeki teknoloji gösteriminde en yüksek üretim yaklaşık 12 g O₂/saat.
- [NASA Mars güneş gücü çalışması](https://ntrs.nasa.gov/citations/19910057365), [Dünya bilgi sayfası](https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html): atmosfer üstünde yaklaşık 590 ve 1361 W/m². Yüzey güneş gücü, toz ve panel veriminden etkilenir; [Opportunity’nin 2018 fırtınası](https://science.nasa.gov/mission/mer-opportunity/) bunun gerçek örneğidir.
- [NASA/JPL gezegen parametreleri](https://ssd.jpl.nasa.gov/planets/phys_par.html) ve [NASA Mars bilgi sayfası](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html): yaklaşık 3,71 m/s² ekvator yerçekimi, 0,6 kPa temsilî yüzey basıncı ve 24 saat 39 dakika 35 saniyelik sol.
- [Curiosity REMS / Gale gözlemleri](https://www.jpl.nasa.gov/news/second-cycle-of-martian-seasons-completing-for-curiosity-rover/): ilk iki Mars yılında ölçülen hava sıcaklığı −100 °C ile +15,9 °C arasında; Jezero için sabit hava tahmini değildir.

Kolonide **1 erzak birimi = 1 kişinin 1 sollük ihtiyacı**. Üç yaşayan astronot her sol her erzak türünden üç birim tüketir. NASA günlük oranları Dünya günü içindir; uçuş kg → kişi-sol dönüşümü sol süresini hesaba katar. Enerji, batarya, üretim verimi, sağlık, tarifler ve büyüme süreleri eğitsel oyun birimleridir. Gerçek veri notları `src/colony/realism.js` içinde bulunur; arayüzdeki ℹ düğmeleri ve **Gerçek veriler** paneli bunları kaynaklarıyla açıklar.

Mars transfer aracı ve insanlı iniş aracı konsepttir. Dairesel/eş düzlemli transfer ve darbeli manevra yaklaşımı kullanılır; gerçek bir insanlı Mars görevinin tam mühendislik modeli değildir. Koloni arazisi MOLA örnekleri ve temsili yerel detaylarla çizilir; NASA tarafından onaylanmış bir üs tasarımı değildir. [Render mimarisi ve performans sınırları](docs/RENDERING.md), [varlıklar ve lisanslar](ASSETS.md).

## Ortak iniş verisi

Emre üretir, Samet aktarır, İhan koloni başlangıcında okur. Şema korunur; aşağıdaki sayılar örnek oyun envanteridir.

```json
{
  "crew": [
    { "id": "astronaut-1", "health": 100 },
    { "id": "astronaut-2", "health": 100 },
    { "id": "astronaut-3", "health": 100 }
  ],
  "supplies": { "food": 12, "water": 12, "oxygen": 12, "spareParts": 1 },
  "modules": ["habitat", "solarPanel", "battery", "oxygenUnit", "waterRecycler", "greenhouse"],
  "landingSite": "flat",
  "surfaceEnergy": 8
}
```

`src/sim/landingPayload.js` uçuş stoklarını kişi-sol birimine çevirir. Yüzeye taşınan erzak, mevcut iniş aracı tahsisi ve uçuşta kalan gerçek stokla sınırlıdır. `src/colony/handoff.js` aktarımı doğrular; geçersiz veya eksik kayıt örnek veriye döner. Alanlar ekip anlaşması olmadan değiştirilmez.

## Geliştirme ve doğrulama

`src/sim/` fizik ve görev mantığını, `src/data/` kaynaklı sabitleri, `src/render/` çizimi, `src/ui/` uçuş arayüzünü, `src/core/` oyun döngüsünü taşır. İhan’ın koloni kuralları `src/colony/mars-koloni.mjs` ve `mars-atolye.mjs` içindedir; arayüz bu kuralları değiştirmez.

`npm test` fizik, görev zinciri, koloni devri ve kaynak sözleşmelerini sınar; `npm run build` üç sayfalı üretim paketini oluşturur. `window.render_game_to_text()` ve `window.advanceTime(ms)` otomatik oyun doğrulamasının girişleridir. Görsel test akışı [docs/RENDERING.md](docs/RENDERING.md) içinde açıklanır. Entegre GPU için çözünürlük ve pahalı efektler kalite ayarlarından azaltılabilir.

## Ekip

- **Emre** — uçuş & fizik
- **İhan** — koloni & kaynaklar
- **Samet** — arayüz & kol terminali

NASA Space Apps 2026 · Sivas

## Ekip için: son hali indirme

Güncel oyun `feature/pro-rebuild` dalında ([PR #6](https://github.com/NASAYarismasi/Emre/pull/6)).

**İlk kez** (Node.js 20+ ve Git gerekli):

```bash
git clone https://github.com/NASAYarismasi/Emre.git
cd Emre
git checkout feature/pro-rebuild
npm install
npm run dev
```

**Daha önce indirdiysen** (proje klasöründe):

```bash
git fetch origin
git checkout feature/pro-rebuild
git pull
npm install
npm run dev
```

Terminalde çıkan adresi (genelde `http://localhost:5173/`) Chrome'da aç. Kolonide doğrudan başlamak için `http://localhost:5173/colony.html` adresini kullan.

Git kullanmadan: GitHub'da oturum aç → [dalın ZIP'ini indir](https://github.com/NASAYarismasi/Emre/archive/refs/heads/feature/pro-rebuild.zip) → klasörü aç → içinde `npm install` ve `npm run dev`.

NASA verileri ve oyun varsayımları [kaynak denetiminde](docs/NASA-KAYNAKLARI.md) listelenir.

## KERK saha analizi

Kolonide tableti açıp **Uygulamalar** bölümünden **Radyasyon**, **Görüntü analizi** veya **Yerel yapay zekâ** ekranına gir. Oyun, localhost üzerinden açık olan Ollama hizmetinde kurulu yerel modelleri listeler. Varsayılan olarak mevcutsa `llama3.2:latest` seçilir. Analiz yalnızca düğmeye basıldığında anlık koloni değerlerini ve varsa son görüntü ölçümlerini Ollama'ya yollar. Bu projedeki istekler işlemciyi kullanır. Görüntü taraması parlaklık, kontrast, karanlık alan ve kenar yoğunluğunu tarayıcıda hesaplar.

Kişisel dozimetre Mars simülasyon saatiyle birikir. Yüzey referansı Curiosity RAD'in Gale verilerinden alınır. Habitatın doz hızını yarıya indirmesi oyun varsayımıdır. [NASA RAD](https://ntrs.nasa.gov/citations/20240009831)
