# Görsel varlıklar ve lisanslar

Tüm çalışma zamanı varlıkları yereldir; oyun internet erişimi olmadan çalışır. NASA adı/amblemi için marka kuralları geçerlidir; NASA onayı iddia edilmez. NASA/USGS görselleri proje kodunun lisansına dönüştürülmez.

## Gezegen ve gökyüzü dosyaları

| Yerel dosya | Kaynak URL / kredi | Lisans ve işleme |
|---|---|---|
| `public/textures/earth-day.jpg` | [NASA Blue Marble: Next Generation, Temmuz](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/), [indirilen dosya](https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/july/world.200407.3x5400x2700.jpg). Reto Stöckli, NASA Earth Observatory/GSFC. | NASA kamu malı; 5400×2700 kaynak 4096×2048'e küçültüldü, JPEG kalite 90. |
| `public/textures/earth-florida-atlantic.jpg` | Aynı NASA BMNG Temmuz serisinin [500 m B1 karosu](https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/july/world.200407.3x21600x21600.B1.jpg). Reto Stöckli, NASA Earth Observatory/GSFC. | NASA kamu malı. 21600² kaynakta 90°B–40°B / 10°K–60°K bölgesi kırpıldı, 4096² JPEG kalite 92'ye indirildi. Kaynak 43 MB dosya dağıtıma dahil değildir. Tekrar üretim: `python scripts/prepare-earth-region.py` (Pillow). |
| `public/textures/earth-night.jpg` | [NASA Black Marble 2016](https://science.nasa.gov/earth/earth-observatory/earth-at-night/), [indirilen dosya](https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144897/BlackMarble_2016_01deg_gray.jpg). Joshua Stevens / NASA Earth Observatory; Miguel Román / NASA GSFC, Suomi NPP VIIRS. | NASA kamu malı; 3600×1800 gri ışık mozaiği, mevcut JPEG korundu. Yalnız gece tarafında emissive katkı. |
| `public/textures/mars-color.jpg` | [USGS Viking MDIM 2.1 kayıt/lisans](https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m), [Planetary Society kamu malı ayna kaydı](https://www.planetary.org/space-images/color-map-of-mars-viking-mdim-2-1), [indirilen PNG](https://planetary.s3.amazonaws.com/assets/images/4-mars/2014/Mars_Viking_MDIM21_ClrMosaic_global_2500m.png). NASA/JPL/USGS. | Kamu malı, USGS kullanım kısıtı yok. 2,5 km/piksel ayna PNG'si 4096×2048 JPEG kalite 89'a küçültüldü; büyük kaynak PNG depoya dahil değil. |
| `public/textures/stars.jpg` | [NASA SVS Deep Star Maps 2020](https://svs.gsfc.nasa.gov/4851/), [4K EXR kaynak](https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/starmap_2020_4k.exr). NASA/Goddard Space Flight Center Scientific Visualization Studio, Ernie Wright; Gaia DR2: ESA/Gaia/DPAC. | [NASA SVS kamu malı politikası](https://svs.gsfc.nasa.gov/help/). 4096×2048 EXR, Three.js EXRLoader ile Float32'ye çözüldü; RGB başına `(x/(1+x))^(1/2.2)` dönüşümü, JPEG kalite 94. Takımyıldız çizimleri kullanılmadı. |

NASA görselleri için [NASA medya kullanımı](https://www.nasa.gov/nasa-brand-center/images-and-media/) geçerlidir. SVS haritası gerçek Hipparcos/Tycho/Gaia/UCAC yıldız konumları/parlaklık/renklerinden türetilmiştir; rastgele yıldız yerleşimi kullanılmaz. Parlaklık gösterim amaçlı azaltılır.

## Mevcut NASA modelleri

| Yerel dosya | Kaynak URL | Lisans ve kullanım |
|---|---|---|
| `public/assets/sls.glb` | [NASA SLS Block 1](https://science.nasa.gov/3d-resources/space-launch-system-sls-block-1/) | NASA kamu malı / kaynak sayfasındaki istisnalar. Önceki prototipte STL → sadeleştirilmiş GLB. Dosya korunur; çalışma zamanında kademe bölgelerine ayrılıp malzeme/renk eklenir. |
| `public/assets/orion.glb` | [NASA Orion Capsule](https://science.nasa.gov/3d-resources/orion-capsule/) | NASA kamu malı / kaynak istisnaları. Önceki STL → GLB korunur, yörünge aracında kullanılır. Mars lander ayrı prosedürel konsepttir. |
| `public/assets/astronaut.glb` | [NASA Astronaut](https://science.nasa.gov/3d-resources/astronaut/) | NASA kaynak modeli; kaynak istisnaları ve NASA medya koşulları geçerlidir. Orijinal Draco GLB korunur. |
| `public/assets/astronaut-seated.glb` | Aynı NASA Astronaut modelinden bu projede türetildi. | Blender'da kalça/diz/omuz/dirsek bölgeleri bükülüp 24° geriye yaslanan sabit oturma pozu işlendi. Rig/animasyon yoktur. Kabinde üç kopyası, minder, ayak dayanağı ve kemerlerle kullanılır. Tekrar üretim: `blender --factory-startup -b --python scripts/pose-crew.py`. NASA kaynak modelinin koşulları geçerlidir. |

## Yazı tipi dosyaları

Tümü [The Barlow Project Authors](https://github.com/jpt/barlow) tarafından, **SIL Open Font License 1.1** ile yayımlanmıştır. Tam lisans `public/fonts/OFL.txt` içinde korunur. [Kaynak lisans URL'si](https://raw.githubusercontent.com/google/fonts/main/ofl/barlow/OFL.txt).

| Dosya | Kaynak URL | Aile / ağırlık / lisans |
|---|---|---|
| `public/fonts/barlow-0.ttf` | [Google Fonts Barlow](https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700) | Barlow 400, OFL-1.1 |
| `public/fonts/barlow-1.ttf` | [Google Fonts Barlow](https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700) | Barlow 500, OFL-1.1 |
| `public/fonts/barlow-2.ttf` | [Google Fonts Barlow](https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700) | Barlow 600, OFL-1.1 |
| `public/fonts/barlow-3.ttf` | [Google Fonts Barlow](https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700) | Barlow 700, OFL-1.1 |
| `public/fonts/barlow-4.ttf` | [Google Fonts Barlow Condensed](https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700) | Barlow Condensed 400, OFL-1.1 |
| `public/fonts/barlow-5.ttf` | [Google Fonts Barlow Condensed](https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700) | Barlow Condensed 500, OFL-1.1 |
| `public/fonts/barlow-6.ttf` | [Google Fonts Barlow Condensed](https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700) | Barlow Condensed 600, OFL-1.1 |
| `public/fonts/barlow-7.ttf` | [Google Fonts Barlow Condensed](https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700) | Barlow Condensed 700, OFL-1.1 |
| `public/fonts/fonts.css` | Aynı Google Fonts CSS yanıtı | Yerel dosyalara yönlendirilmiş `@font-face` bildirimleri; OFL fontları kullanır. |
| `public/fonts/OFL.txt` | [Google Fonts OFL metni](https://raw.githubusercontent.com/google/fonts/main/ofl/barlow/OFL.txt) | Değiştirilmemiş OFL-1.1 metni. |

## Mevcut çözücüler

| Dosya | Kaynak / lisans |
|---|---|
| `public/draco/draco_decoder.js` | [Three.js Draco dağıtımı](https://github.com/mrdoob/three.js/tree/dev/examples/jsm/libs/draco); Draco Apache-2.0, dosya üstbilgileri korunur. |
| `public/draco/draco_decoder.wasm` | Aynı dağıtım, Draco Apache-2.0. |
| `public/draco/draco_wasm_wrapper.js` | Aynı dağıtım, Draco Apache-2.0. |
| `public/draco/THREE-LICENSE.txt` | [Three.js MIT lisansı](https://github.com/mrdoob/three.js/blob/dev/LICENSE); mevcut metin korunur. |

## Prosedürel içerik ve tamamlanabilecek varlıklar

Bulut alfa haritası, scrub/beton/folyo/kum dokuları, LC-39B geometrisi, Mars arazi/kayaları, lander, kabin, etiketler ve plume/duman/plazma/toz shaderları bu projede üretilir; üçüncü taraf resim içermez. Ses WebAudio ile üretilir, ses dosyası yoktur. Prosedürel bulut ve arazi gerçek zamanlı hava/DEM değildir.

İlk `eoimages.gsfc.nasa.gov` bağlantıları reset, doğrudan USGS indirmesi erişim hatası verdi; yukarıdaki NASA Science/Planetary Society kaynaklarıyla **gerekli dört harita tamamlandı**. Başlangıçta indirilen 1K yıldız önizlemesi son 4K EXR türeviyle değiştirildi.

İsteğe bağlı gerçek bulut haritası için [NASA Blue Marble Clouds kaydı](https://visibleearth.nasa.gov/images/57747/blue-marble-clouds) üzerinden `cloud_combined_2048.jpg` indirilebilir; bu ortamda eski [doğrudan adres](https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_2048.jpg) erişilemedi. Şimdilik seeded prosedürel alfa kullanılır. Ayrı NASA okyanus/specular maskesi bulunmadığından gündüz dokusunun mavi baskınlığından yaklaşık okyanus maskesi hesaplanır. Mars yerel DEM/normal haritası eklenmedi; gerçek araziyle eşleştirilmiş bir iniş sahası yoktur.

## Mars kolonisi (İhan — `src/colony/`, `public/models/colony/`)

<!-- INIS: shared procedural lander; no additional third-party asset. -->
`src/render/marsLander.js` içindeki ortak iniş aracı/kalkanı bu projeye ait özgün prosedürel geometridir; NASA modeli veya amblemi içermez, harici varlık yüklemez. DRA 5.0/SRP referansları bilimsel bağlamdır. Jezero kenarı/deltası ve motor aşınma izleri de prosedüreldir; gerçek DEM/CFD verisi oldukları iddia edilmez.
<!-- END INIS. -->

| Dosya | Kaynak | Lisans / not |
|---|---|---|
| `public/models/colony/habitat-nasa.glb` | [NASA/LaRC Habitat Demonstration Unit](https://science.nasa.gov/3d-resources/habitat-demonstration-unit/) | NASA medya kuralları |
| `public/models/colony/insight.glb` | [NASA InSight Cruise Lander](https://science.nasa.gov/3d-resources/insight-cruise-lander/) (Brian E. Kumanchik) | NASA medya kuralları |
| `public/models/colony/perseverance.glb` | [NASA/JPL Mars 2020 Perseverance](https://science.nasa.gov/3d-resources/mars-2020-perseverance-rover/) | NASA medya kuralları |
| `public/models/colony/ingenuity.glb` | [NASA/Brian E. Kumanchik · Ingenuity Mars Helicopter](https://science.nasa.gov/3d-resources/ingenuity-mars-helicopter/) · İhan’ın `kaynak/public/models/ingenuity.glb` dosyası | NASA 3D Resources; NASA medya kullanım kuralları ve kaynak istisnaları geçerlidir. GLB değiştirilmedi; sahnede 1,2 m genişliğe ölçeklenir. |
| `public/models/colony/team-astronaut.glb` | [NASA Astronaut](https://science.nasa.gov/3d-resources/astronaut/) · İhan’ın `kaynak/public/models/team-astronaut.glb` dosyası, Emre’nin uçuş astronotu | NASA 3D Resources; NASA medya kullanım kuralları ve kaynak istisnaları geçerlidir. GLB değiştirilmedi; sahnede 1,88 m boya ölçeklenir. |
| `src/colony/scene/jezero.json` | [NASA PDS MGS/MOLA MEGDR](https://pds-geosciences.wustl.edu/missions/mgs/megdr.html), Jezero Krateri 25×25 örnek | Kamu malı veri |

Koloni kuralları, kaynak miktarları, tarım ve atölye değerleri eğitsel oyun birimleridir (İhan, `MARS-ENTEGRASYON.md`). Uçuştan koloniye birim dönüşümü: `src/sim/landingPayload.js` (1 birim = bir astronotun bir sollük ihtiyacı, NASA Ames Tablo 1 oranlarıyla).

<!-- SYNC: procedural surface provenance; no external imagery added. -->
`src/colony/scene/crater-terrain.mjs` ve `regolith-detail.mjs`, İhan’ın `kaynak/src/crater-ecosystem.mjs` içindeki prosedürel krater profilleri ve 512² regolit detay üreticisinden uyarlanmıştır. Merkezde 60 m çaplı düz oyun sahası, dışta yassı taşlar ve seyreltilmiş instanced çakıl halısı vardır. Yerel yükseklikler ölçülmüş Jezero DEM’i değildir. Mevcut MOLA tabanlı bölgesel ufuk ve YÜZEY’in Mars24 ortamı korunur; HiRISE ortofotosu veya ikinci gökyüzü/ışık sistemi eklenmedi.

## Düz Ova entegrasyonu (OVA, 2026-11-14)

`src/colony/ova/` içindeki arazi dokuları, üç kubbeli basınçlı üs, tüneller, hava kilidi, iç donanım, haberleşme kulesi ve 42 masalı güneş tarlası **İhan** tarafından üretilen prosedürel konsepttir. Kaynak: `vendor-ihan/MARS-KOLONISI-DUZ-OVA.html`, `NASAYarismasi/-lhan` commit `d6caf78`. Ayrı kaynak kodu bulunmadığından uygulama bölümü kurulu Rolldown/Oxc ile biçimlendirilip paketlenmiş Three.js kodundan ayrılmıştır; Three.js ve yükleyiciler projedeki npm sürümünden alınır. NASA bu konsept üssün tasarımcısı değildir. Uygulama kodunun ekip içi kökeni korunur; NASA varlıklarının koşulları ayrıca geçerlidir.

| Gömülü varlık | Yeniden kullanılan dosya | Kaynak / koşullar |
|---|---|---|
| `scene-rover` | `public/models/colony/perseverance.glb` | İhan’ın README kaynağı: [NASA/JPL Mars 2020 Perseverance, NASA 3D Resources](https://science.nasa.gov/3d-resources/mars-2020-perseverance-rover/). NASA medya kullanım koşulları; gömülü GLB ile birebir aynı baytlar, SHA-256 `10db7c03a5e63a5a3b3e7baa6243aa4918ba045fa8ff0a731d0217491adc727f`. |
| `scene-suit` | `public/models/colony/team-astronaut.glb` | İhan’ın README kaynağı: [NASA Astronaut, NASA 3D Resources](https://science.nasa.gov/3d-resources/astronaut/). NASA medya kullanım koşulları; gömülü GLB ile birebir aynı baytlar, SHA-256 `d18c141410542b935113d1c25a9271d90c40d44015a64295b7b68a30f0ce2820`. |

Gömülü Draco/WASM tekrar dağıtılmadı; mevcut `public/draco/` Apache-2.0 çözücüleri kullanılır. Tekrar çıkarım / karşılaştırma: `node scripts/recover-ova.mjs`; okunabilir ham uygulama ve dosya özeti `output/ova/` altına yazılır, elle entegre edilmiş modüller değiştirilmez.

Düz Ova, yukarıda tarihsel olarak anlatılan MOLA bölgesel ufku / krater ekosisteminin **aktif koloni sahnesindeki yerini alır**; eski NASA HDU, InSight ve Ingenuity sahneye yüklenmez. Eski dosyalar ve bağımsız testleri depoda korunur. Düz Ova gerçek Jezero DEM’i değildir. 620 m düzlüğün çok küçük yükseklik dalgaları, renkleri ve 108 ufuk tepesi kaynaktan korunur; 36.600 taş/çakıl 6.550 instance’a, zemin ağı 320×320’den 96×96’ya indirilir. Güneş tarlası aynı yerleşimle beş instanced draw kullanır. Güneş, gökyüzü, yıldızlar, sis, gün/gece ve kafa lambası ortak `environment.mjs` tarafından yönetilir.

Rover lens adaptation: `src/colony/ova/assets.mjs` disables screen-space transmission on three tiny NASA camera-lens materials and uses translucent glass instead. Meshes, textures, scales and source GLB bytes are unchanged; this removes an extra whole-scene refraction pass on software GL.

## Selective Emre integration (097c3aa)

- `team-astronaut-walk.glb`: NASA Astronaut (DigitalSpace Corporation) türevi. Blender’da orijinal üçgenleri ve UV’leri koruyan ağırlıklı omuz/kalça iskeleti eklendi. NASA kaynak modelinin koşulları geçerlidir.
- `public/art/eva-gloves.png`: Aynı NASA Astronaut modelinin el ve bilek geometrisi Blender’da KERK tabletinin tutuşuna göre pozlanıp saydam görüntüye işlendi. Model ve görsel aynı komutla üretilir. `blender --factory-startup -b --python scripts/pose-walker.py`.
- `perseverance-wheels.glb`: existing NASA/JPL Perseverance model with separated wheel hubs; prepared by Emre (`scripts/split-rover-wheels.py`), original NASA conditions retained.
- `public/art/eva-tablet-grip-*.svg`: Emre branch original EVA grip artwork, CC0 1.0. Samet display and local notifications retained.
- Communications tower, facility computers and particle effects: team procedural source from Emre `feature/pro-rebuild` commit 097c3aa; local facility positions and original resource calculations preserved.

Battery enclosure and cable terminal geometry: adapted visual portions of Emre/İhan solar-farm and power-cables sources at 097c3aa. Their new microgrid rules are not imported. Long cable runs are buried and not drawn. Rover dock is a new procedural concept; 250 W charging is a game assumption, with delivered kWh deducted from the existing support energy budget.

Power integration preview uses NASAYarismasi/-lhan branch son, commit 97bc753. Original power, panel-production, recovery and projection modules preserved.

## Samet ana menüsü

Menü arayüzü ve açılış sahnesi [Samet’in kol-ekrani dalından](https://github.com/NASAYarismasi/Samet/tree/codex/kol-ekrani) alındı ve görev seçimine bağlandı. `public/art/mars-nasa.jpg`, [NASA/JPL-Caltech Mars modeli sayfasında](https://science.nasa.gov/3d-resources/mars/) yayımlanan Viking görüntülerinden işlenmiş USGS dokusudur. `public/art/astronaut-lineup.png`, aynı dalda yer alan, ImageGen ile üretilmiş seçme ekranı portreleridir.
