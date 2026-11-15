# Düz Ova yerleşimi — 15 Kasım 2026

Koordinatlar metre; +X doğu, -Z kuzey. Ortak kaynak: `src/data/colonyLayout.js`.

| Öğe | X / Z | Merkezden uzaklık | Ayrılan yarıçap |
|---|---|---|---|
| Baz istasyonu | -38 / -27 | 46,6 m | 7 m |
| Mürettebat iniş aracı | -16 / -91 | 92,4 m | 14 m |
| İlk FPS doğuşu | -16 / -82 | +Z merdiven önü | — |
| Rover parkı | 5,75 / 14,5 | Mevcut park korunur | — |

İlk bakış doğrudan kubbe merkezine yönelir (`arrivalYaw = -2.9488918949 rad`); iniş aracı arkada kalır. Bayraklı rota kubbelerin batı kenarından güneydeki hava kilidine gider. Padler ve yürüyüş koridoru, deterministik kaya dağılımından temizlenir. Sera, hava/su tesisleri, güneş tarlası, tesis bilgisayarları ve kurulum alanı mevcut yerlerinde kalır. NPC/rover engelleri, inşaat sınırları, harita ve yeni görünüm düğmeleri ortak yerleşimle tutarlıdır. Uçuştan gelen iniş yükünün JSON şeması korunur; koloni sahnesi her iki başlangıç türünde aynı iniş konumunu kullanır.

Kule: dört yüzlü kafes mast, dört gergi ankrajı, metal tablalı vidalı regolit ayaklar, azimut/yükseliş mafsallı çanak, UHF kamçıları ve ekipman kabini. İki koyu kablo, kuzey servis kenarından habitat bağlantı kutusuna gider. Çanak, mevcut gece göğünün **temsili** Dünya yönünü ufkun üzerindeyken izler; diğer zamanlarda sabit bir temsili röle yönüne döner. Gerçek bir efemeris veya RF bağlantı hesabı değildir. Tepe lambası gerçek saniyeyle 40 darbe/dakika yanar; emissive küre ve yumuşak sprite kullanır. Ek gerçek zamanlı ışık yoktur.

İniş alanı, zemini izleyen ve kenarı yumuşakça kaybolan püskürtme izi ile dört ayak izi içerir. Bütün boyutlar, konumlar ve işaret zamanlaması **GAME ASSUMPTION** olarak kodda belirtilir. 92,4 m, oynanabilirlik için kısaltılmış bir mesafedir; gerçek bir güvenli iniş ayrımı değildir. Gerekçe kaynağı [NASA Mars DRA 5.0 ek raporu](https://www.nasa.gov/wp-content/uploads/2015/09/373667main_NASA-SP-2009-566-ADD.pdf). Prosedürel parçalar `batchStaticLeaves` ile birleştirilir; çanak mafsalları ve tepe lambası canlı kalır. Sahne kapanışı kaynakları temizler.

## Doğrulama

- `npm test`: **30 dosya / 154 test** geçti. Yeni testler bütün tesis/NPC/rover keep-out'larını, padler arası ayrımı, ilk keşif halkasını, zemin düzlüğünü, sahnedeki gerçek kaya/kutu sınırlarını, doğuş yönünü, çanak yönünü ve lamba döngüsünü denetler. Mevcut altı Düz Ova ışığı korunur.
- `npm run build`: başarılı; mevcut büyük paket uyarısı sürer.
- Bu klasörden `npx vite --host 127.0.0.1 --port 5174 --strictPort`; Chromium `--use-gl=angle`, AMD Radeon / D3D11, 1440×900, piksel oranı 1. Beceri istemcisi ayrıca çalıştırıldı. Sandbox yalnız workspace'e yazdırdığı için ek QA betiği burada çalıştırıldı ve beceri klasöründeki mevcut Playwright kurulumunu doğrudan kullandı; beceri klasörüne kopya yazılmadı. Geçici betik sonrasında kaldırıldı.
- Gerçek tuşlar/UI ve `advanceTime`: merdivenden yürüme, zıplama/zemine dönüş, Q bilek bilgisayarı, bütün yeni kameralar, lamba açık/kapalı aralığı, gündüz/gece, işaretli rota üzerinden habitat girişi/çıkışı ve haritadaki iki koordinat doğrulandı. Tarayıcı hata listesi boş.
- Beş görünümde **605–885 draw call**; ilk FPS görünümü **851**, bütün üs görünümü **854**. CPU/GPU alanları anlık gözlem değerleridir, sabit FPS garantisi değildir. Ölçümler: [layout-performance.json](screenshots/layout-performance.json).

Görsel olarak incelenen ekran görüntüleri ve yanlarındaki SI telemetri JSON'ları:

- [İlk FPS bakışı](screenshots/layout-spawn.png)
- [Baz istasyonu / gündüz](screenshots/layout-tower-day.png)
- [Baz istasyonu / gece, kırmızı lamba](screenshots/layout-tower-night.png)
- [İniş alanı](screenshots/layout-lander-pad.png)
- [Üs yerleşimi](screenshots/layout-overview.png)

İşlevsel açık madde yok. Paket kurulmadı; commit/push yapılmadı. Korunan üç koloni kural dosyası değiştirilmedi. Geliştirme sunucusu doğrulama sonunda durduruldu.
