# İhan kaynak birleştirmesi — 15 Kasım 2026

Temel: `a7d5ce6`; gelen kaynak: `ed79956`. Ekip deposu salt okunur kullanıldı. Commit, push veya paket kurulumu yapılmadı. `mars-koloni.mjs`, `mars-atolye.mjs`, `mars-gorev-plani.mjs` ve ortak iniş JSON şeması değiştirilmedi.

## Dosya bazında sonuç

`git merge-file -p --diff3 ours base theirs` kullanıldı. Önce satır sonları LF olarak normalleştirildi; aksi halde CRLF/LF farkı bütün dosyayı çatışmalı gösteriyordu.

| Dosya (`src/colony/ihan/`) | Sonuç |
|---|---|
| `crater-ecosystem.mjs` | Üç çatışma çözüldü. Host'un `createOvaWorld` fabrikası, BASE_URL dokuları, arazi optimizasyonları ve ayrı render döngüsünü kaldıran uyarlaması korundu. Yeni habitat lumbozları, fırçalı metal kapılar, sera konumu ve güneş dağıtım bağlantısı alındı. Tek sera host tarafından oluşturulur. |
| `first-night.mjs` | Bir import çatışması çözüldü. Yerel `hava`/`su` yolları korunarak LED, sulama, şalter ve karşılaştırmalı ilk gece hesaplarının tamamı alındı. Bağımsız panel yoksa erken dönüş korunur. |
| `solar-farm.mjs` | İki çatışma çözüldü. On inverter, dağıtım ekranları, şalter ve kablo sistemi alındı. Host'un panel instancing'i korundu; statik kablo/kabinler malzemeye göre birleştirildi. Hareketli şalter ayrı tutuldu; DOM kontrolleri isteğe bağlı, listener ve kaynak temizliği eklendi. Canlı ekrandaki `/10` batarya gösterimi toplam 180 kWh ile tutarlı olacak şekilde düzeltildi. |
| `mars-power.mjs` | Yeni dosya. LED, su, sondaj ve güneş sabitleri aynen alındı. İsteğe bağlı on inverter ve batarya desteği anahtarları eklendi. Eski iki parametreli çağrının altı senaryosu gelen dosyayla birebir aynı sonuç verir. |
| `power-cables.mjs` | Yeni dosya. İhan'ın DC/AC yolları, dağıtım ve yük kabinleri korundu. Hareketli kol dışarı açıldı; sera kablosunun eski dolaşım noktası yeni konuma göre kısaltıldı. BASE_URL gerektiren harici varlık veya base64 yok. |
| `greenhouse-pressure.mjs` | Yeni dosya. Basınç sesi gerçek E döngüsüne bağlandı; sahne kapanırken AudioContext temizliği eklendi. Ses prosedüreldir. |

`sistemler` kaynaklarında bu iki commit arasında değişiklik yoktu. `sera.mjs` içindeki yatak başına nokta ışıklarını kaldıran host uyarlaması korunur.

## Tek sera ve yerleşim

- Sera `(26,-11)` → **`(19,25)`**. İhan'ın mevcut çift kapılı sera haznesi kullanılır; ikinci sera oluşturulmaz.
- Sera bilgisayarı `(30.4,-1.4)` → `(23.4,34.6)`. E yaklaşımı, hazneye ışınlama ve çıkış, iç yürüyüş sınırları, sulama sisi, LED'ler, inşaat çarpışmaları ve gözlem telemetrisi yeni orijini kullanır.
- NPC çalışma noktası `(19.8,35.6)`; sera keep-out merkezi `(19,26)`. Rover keep-out'u ayak izi ve hazne için büyütüldü.
- Eski Delta araştırma noktası `(25,26)` sera yakınına denk geldiği için **`(33,30)`** oldu. İstasyon işaretleri, rota ve harita bu sim koordinatını okur.
- Hava tesisi `(19,6)`, su tesisi `(64,-26)`, rover parkı `(5.75,14.5)` ve kurulum alanı `(0,18)` taşınmadı; sera ile çakışmıyorlar.
- Güç bilgisayarı `(-19.9,62.5)` konumunda. E veya çekmece 09 üzerinden açılır. On inverter hattı, ana sera/sondaj şalteri ve batarya desteği ayrı yönetilir.

## Sayılar ve enerji hesabı

- LED: **3.36528 kW** = altı `1.28 × 2.37 m` yatak, PPFD 350, `2.5 µmol/J`, %80 optik verim ve `0.18 kW` alg ışığı.
- Batarya: **180 kWh**; şarj verimi %90. Başlangıç iniş enerjisinin host dönüşümü `12 kWh/birim` olarak korunur; sonraki sollerde oyun bataryasından yeniden doldurulmaz.
- 42 masa / 420 panel / 10 inverter: ilk iki inverter doğrudan sera/sondaj, kalan sekizi habitat/batarya. Açık hava güneş tahmini **420 kWh/sol**, fırtına geçirgenliği %20 ile **84 kWh/sol**.
- Habitat tasarım zarfı gündüz **60 kWh / 12.33 saat**, gece **6 kW**. Hava ve geri kazanım yükleri bu zarfın içinde sayılır; ikinci kez eklenmez. Birim kapatıldığında veya tank dolduğu için daha az iş yaptığında yalnızca gerçek tüketim düşülür.
- Sondaj **2 kW**. Güç görünümündeki süblimasyon hesabı **1.8763621795 kWh/L**, %10 buz ve %80 yakalama kullanır; 100 L için **93.8181 saat** gerekir.
- **İhan'ın iki su modeli farklıdır:** çalışan `stepWater`, `sistemler/su.mjs` değerlerini korur: %50 buz, 2 kW ile 20 L / 6 saat, %85 geri kazanım. Güç tahmininin litre değeri, gerçek `water.extractedL` yerine yazılmaz. İlk gece önizlemesinde gelen süblimasyon senaryosu korunur. Kodda ve güç panelinde bu ayrım açıklanır.

`src/sim/colonyPower.js` saf ve deterministik canlı dağıtımı yapar. İhan'ın `solarEnergy` ve `powerForecast` formülleri fiziksel temeldir. Gerçek zamanlı güneş profili Mars24 yüksekliğini kullanır; sol düğmesinin tamamladığı süre, aynı 12.33 saatlik normalize gündüz profiliyle ilerler. Ana şalter habitatı kesmeden sera, sulama ve sondajı keser. Batarya desteği kapalıyken bu yükler yalnızca doğrudan inverter kolundan beslenir.

## Doğrulama

- `npm test`: **29 dosya / 143 test**. Yeni testler LED/su ayrımını, her inverter kolunu, fırtınayı, ana şalteri, gece batarya desteğini, tükenmeyi, gerçek enerji muhasebesini ve sol geçişinde bataryanın korunmasını sınar. Dashboard için eksik alanlar ve yeni fiziksel telemetri sınanır; rover rotaları yeni keep-out ile geçer.
- `npm run build`: başarılı; önceden var olan büyük paket uyarısı sürer.
- Bu klasörden `npx vite --host 127.0.0.1 --port 5174 --strictPort` kullanıldı.
- Tek Chromium, `--use-gl=angle`, 1440×900, piksel oranı 1. İki referans HTML `file://` ile incelendi. Beceri istemcisi ve beceri klasöründeki kurulu Playwright kullanıldı. Yazma alanı kısıtı nedeniyle geçici ek betikler workspace'te tutuldu; beceri klasörüne dosya yazılmadı.
- Referans paketlerin `file://` açılışındaki geçersiz URL tabanı, yalnızca karşılaştırma tarayıcısında geçici bir URL tabanı uyarlamasıyla giderildi; kaynak depo ve oyun dosyaları değiştirilmedi. İki paketin dağıtım kutusu/inverter/kablo görünümü açılıp görsel olarak karşılaştırıldı.
- Gerçek klavye ve `advanceTime` ile: yeni seraya yürüyüş, iki aşamalı E girişi/çıkışı, gece LED'leri, ana/inverter/batarya şalterleri, kafa lambası, Q tablet, dashboard ve rover bilgisayarı kontrol edildi. Rover yeni Delta'ya ulaşıp beş cihaz ölçümünü tamamladı. Koloni kuralları beşinci sola ilerletildi; gerçek fırtına durumu fiziksel güneşe %20 geçirgenlik olarak geçti. Tarayıcı hata listesi boş.
- Sekiz tesis kamerasında **74–986 draw call**; başlangıç FPS ölçümünde **1.021**. Hepsi yaklaşık 1.100 sınırının altında. Tam ölçümler: `screenshots/ihan-merge-performance.json`.
- Beş istenen görüntü ve rover ek görüntüsü `screenshots/ihan-merge-*.png` altında; her görüntünün SI telemetrisi yanında JSON olarak bulunur.

İstenen işlevlerde açık kalan madde yok. Geçici betikler temizlendi ve sunucu görev sonunda durduruldu. Commit/push yapılmadı.
