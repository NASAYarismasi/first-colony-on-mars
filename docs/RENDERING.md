# Görsel uçuş katmanı

`src/main.js` yalnızca `bootstrap()` çağırır. `src/core/app.js` komutları, 50 Hz simülasyonu, bağımsız anlık görüntüleri ve çizimi bağlar. Fizik çekirdeği, kütle muhasebesi, görev geçişleri ve ortak iniş JSON sözleşmesi korunur.

## Zaman, koordinatlar ve sahiplik

- `captureRenderState()` simülasyondaki gerçek konum/hız vektörünü, kademe bağlantılarını, atmosferi, olayları ve orbital elemanları kopyalar. Render kodu canlı görev nesnesine erişmez.
- `interpolateState(previous, current, alpha)` konumu, yönelimi, zamanı, gezegen konumlarını ve ayrılan parçaları enterpole eder. Referans çerçevesi değişen fazlar arasında enterpolasyon yapılmaz.
- Yerel araç sahnesi metre ve Y-yukarı kullanır. GPU'ya yüklenmeden önce çift duyarlıkta araç konumu çıkarılır, gözlemcinin radyal/teğetsel tabanına dönülür. Gezegenler gerçek yarıçaplıdır; logaritmik derinlik tamponu kullanılır. Yerel rampa yüzeyi, küresel düşük detay yüzeyinin hemen üstündedir.
- Seyirde uzaktaki gezegenlerin konum farkı **ve yarıçapı birlikte** 10⁻⁵ ile ölçeklenir; açısal boyut korunur. Harita ayrı ölçekli sahnedir; heliosentrik harita gezegen simgelerini görünürlük için büyütür.
- `sceneManager` etkin sahnenin `enter(ctx)`, `update(state, alpha)`, `exit()` yaşam döngüsünü yönetir. Geometriler, malzemeler, shader doku birimleri, gölge hedefleri ve dinleyiciler temizlenir. Paylaşılan kaynak GLB/dokuların sahibi varlık önbelleğidir; uygulama kapanınca onlar da bırakılır.
- Dumanın yayıldığı konumlar sabit fizik döngüsünden 5 Hz'de örneklenir. Parçacıklar dünyaya bağlı konumlarını korur; yaşlanma simülasyon saatine bağlıdır. Görsel rüzgâr/buoyancy, türbülans ve toz kuvvet çözümü değildir.

## Kontroller ve demo akışı

1. **Geri sayımı başlat** veya **Boşluk/E**: T−10. RS-25 başlangıcı T−6,5; SRB ateşleme/kalkış T0. `src/sim/countdown.js` saf ve testlidir. Geri sayım beklemesinde uçuş yakıtı tüketilmez; bu terminal motor başlangıcının görsel/sekans yaklaşımıdır.
2. **1–6** doğrudan kamera seçer; **C** sıradaki kamerayı seçer. Takip kamerası fare sürükleme/tekerlek ile kontrol edilir. Kabin kameraları üç mürettebatı, canlı CanvasTexture ekranlarını ve aynı dış gezegen sahnesini gösterir.
3. **, / .** hız azaltır/artırır, **T** hız artırır. 10× üstü motor kapalı/atmosfer dışı koşuluna tabidir. **B** Dünya park yörüngesinde TMI, Mars yörüngesinde deorbit başlatır. Varış/MOI otomatiktir.
4. **A** yalnızca kalkış/TMI/MOI'de manuel gaz kolunu açar. **Shift/Ctrl** artırır/azaltır, **Z/X** tam/kes. SRB ve EDL gazı kullanıcı kontrolünde değildir. Varsayılan kılavuzlama otopilottur.
5. **Esc/P** duraklatır; menüden kalite, uyarlama, ses ve sıfırlama seçilir. **H** yardım, **Q** kol bilgisayarı, **M** ses, **F** tam ekran.

`window.advanceTime(ms)` aynı fizik adımlarını tamamlar ve gerçek zamanlı fizik akışını test süresince durdurur. Kamera/çizim RAF'ı çalışır. `window.missionControl` yalnızca normal kullanıcı komutlarını sunar; faz/konum ayarlayıcısı yoktur. `render_game_to_text()` SI telemetri, kamera, geri sayım, hız, kalite ve GPU sayaçları verir.

## Görsel ve ses yaklaşımı

ACES/sRGB, fiziksel ışıklandırma, rampa gölgeleri, UnrealBloomPass, FXAA, hafif gren/vinyet. Kamera ivme ve dinamik basınca bağlı küçük sarsıntı uygular. Güneş yönü yaklaşık bir aydınlatma yönüdür; takvim ephemerisi değildir.

NASA SLS tek parça geometrisi uzamsal olarak SRB/ana gövde/ICPS/Orion/LAS bölümlerine ayrılır. LOD seçimi kamera görüş açısını hesaba katar; uzun lens gerçek detayını korur. Ayrılan parçalar `src/sim/debris.js` içinde ters-kare yerçekimi ve varsayılan ayrılma impulsu/açısal hızıyla ilerler. Ana uçuşun kütle/yörüngesini değiştirmezler. Aerodinamikleri ve yere çarpmaları modellenmez; 90 s sonra bırakılırlar.

Altı başlangıç motoru için ayrı shader plume vardır; ortam basıncı azaldıkça genişler. SRB turuncu-beyaz, hydrolox mavi-mor ve düşük irtifada Mach elmaslıdır. Mach 0,9–1,1 civarında yoğuşma, EDL'de anlık Sutton–Graves ısı akısından plazma, motorlu inişte retro egzoz/toz gösterilir. Bunlar mühendislik CFD/ışınım çözümleri değildir.

WebAudio gürültü kaynakları rumble/crackle üretir. Yer kamerası geçmiş itki örneklerini mesafe/343 s gecikmeyle duyar; kabin filtrelenmiş titreşim duyar. Atmosfer dışında dış kamera sessizdir. İşitsel yayılım hava sıcaklığı/rüzgârını çözmez.

## Performans ve sınırlar

Statik rampa kafesleri malzemeye göre birleştirilir; scrub/kayalar instancing kullanır. Parçacık sayısı sınırlıdır. Düşük/Orta/Yüksek piksel oranı tavanları 0,8/1,15/1,6; düşük ayarda bloom/gölge kapalıdır. Otomatik kalite uzun süreli yavaşlamada çözünürlüğü düşürür. **60 FPS hedeftir; gerçek orta sınıf dizüstünde ölçüm yapılmadı.** SwiftShader doğrulaması görsel/doğruluk içindir.

Bulut haritası, LC-39B ayrıntıları, Mars lander ve yerel Mars arazisi prosedürel/temsili. Gerçek Mars DEM/normal haritası yoktur. Kabin ölçüleri ve Blender'da işlenen sabit oturma pozu yaklaşık, rig animasyonu değildir. Atmosfer tek saçılma benzeri rim/yoğunluk yaklaşımıdır; hacimsel bulut/soft-depth parçacık çözümü değildir. TMI/MOI'nin temel modeldeki darbeli manevra yaklaşımı devam eder; ayrı ayrıntılı NTR dış modeli yoktur.

## Task 3 — Görsel son düzenleme

- Açılışta yavaş hareket eden rampa kamerası üzerinde ana menü, kontroller ve kaynak/ekip penceresi bulunur. Göreve Başla T−10 geri sayımını açar; sıfırlama başlık ekranına döner.
- Kabin artık Blender'da oturtulmuş NASA astronot türevini kullanır. Kamera 2 önden çapraz bakarak yaslanmış gövdeyi, bükülü dizleri, aşağıdaki kolları, minder/kemer/ayak dayanaklarını gösterir.
- Kademe şeması `attached` durumlarından SRB → ana → ICPS/Orion ayrılmalarını, ardından transit ve iniş aracını izler. Negatif apsis irtifaları çizgi ve “yörünge altı”, açık yörüngenin apoapsisi “açık yörünge” olarak gösterilir.
- Sis azaltıldı; mavi sabah göğü, görünür Atlantik ufku ve egzozun aydınlattığı kule/pad/duman güçlendirildi. Kesikli ekran çizgisi debug göstergesi değil, alt piksel kalınlığındaki yıldırım koruma kablolarının aliasing'iydi; kablolar kaldırıldı, direkler korundu.
- Dünya küresi daha sık üçgenlenir; Florida–Atlantik yüksek çözünürlüklü NASA bölgesi doğru boylama yerleştirilip alçak irtifada harmanlanır. Tiled prosedürel detay/normal katkısı, 10,5 km yüksek bulut kabuğunun paralaksı ve sim saatine bağlı yavaş bulut sürüklenmesi eklenir. Bulutlar gerçek hava verisi değildir.
- Mars aracı geniş, çok yüzlü insanlı iniş konseptidir. Girişte 15 m aeroshell, ısı akısına bağlı plazma/ısınma parıltısı ve ablasyon izi görünür. SRP olayında kalkan bağımsız simülasyon izine geçer; ≤1000 m'de dört bacak üç sim saniyesinde açılır. Dört motor plume'u gerçek gaz kolu ve itki yönünü izler; toz ve yüzey aşınma izi son 30 m'de belirir, temas tozu sunum saatinde çöker.
- Harita tüm transfer elipsini kesikli, uçulan yayı düz çizer. Varış halkası ve ekran uzayında çakışma denetimli etiketler bulunur. Deterministik test adımları, analitik seyir sıçraması sonrasında güncel snapshot'ı çizer; normal RAF enterpolasyonu korunur.
- Q, sağ altta erzak günleri, görev saati/fazı, kabin güç durumu ve sonraki olay için kol bilgisayarını açar. Erzak günleri sim kg / (kişi başı günlük tüketim × mürettebat) hesabıdır. Kabin gücü sim telemetrisindeki açık/kapalı veri yoludur; elektrik tüketimi/batarya modeli değildir.

Uçuş sabitleri, ana aracın kuvvetleri, görev geçişleri ve ortak iniş yükü değişmedi. Ayrı kalkan izinin varsayımları `docs/PHYSICS.md` içinde açıklanır. Türkçe zaman çizelgesi ve sistem etiketleri İngilizce olay kodlarının yerini aldı.

<!-- INIS: surface worker integration contract and landing QA. -->
`src/render/marsLander.js` içindeki `createMarsLander(): THREE.Group` uçuş ve koloni için ortak prosedürel modeldir: metre, +Y yukarı, ayak tabanları y=0, kapı/merdiven +Z. Varsayılanı yerde ve bacakları açık durumdur. DOM/GLB/doku yükleyicisi gerektirmez; kaynakları çağıran sahne temizler. Uçuş aeroshell'i ayrı ekler; koloni yalnızca bu fonksiyonu çağırır. `landing-gear`, `landing-leg-0…3`, `footpad-0…3`, `crew-hatch`, `crew-ladder` isimleri korunur.

Yerel arazi Jezero'nun yaklaşık 45 km çapındaki kenarını ve batı deltasını temsil eder; gerçek DEM değildir. Yakın yüzey ve 650 instanced kaya inişte ayrıntılanır; son kilometrede arazi dönen yüzeye sabitlenir. Gölge üreten tek ışık güneştir. Kamera 2, Mars'ta +Z yönündeki aşağı bakan iniş penceresine; kamera 3 yerel iniş sahasına geçer. Kamera 5 alçak inişte yer takibine geçer.

Temas sonrası kamera kapıya yaklaşır, son 1,5 saniyede “Sol 1 · Jezero Krateri” kararması görünür; yaklaşık altıncı gerçek saniyede `saveLandingPayload()` ardından `colony.html` açılır. Enter veya Boşluk geçişi öne alabilir. Duraklatma sunum saatini de durdurur. Oturum depolaması başarısız olursa yeniden deneme düğmesi görünür. HUD eklemeleri `INIS` yorumlarıyla sınırlandırılmıştır; Q/Alt/L değiştirilmedi.

İniş QA: plazmalı giriş, kalkan ayrılması, 1000 m bacak hareketi, son 30 m motor tozu, üç iniş kamerası, 0–6 s kapı yaklaşması/kararma, Enter/Boşluk ve otomatik geçiş sonrası gerçek uçuş kaynakları kontrol edilmelidir. Bu işçi paralel çalışma talimatı nedeniyle sunucu/tarayıcı/Playwright başlatmadı; görsel kontrol orkestratöre aittir.
<!-- END INIS. -->

## Doğrulama

`npm test`, `npm run build`. Tarayıcı akışı: `npm run preview -- --host 127.0.0.1 --port 5177`, sonra `node scripts/render-qa.mjs`. Playwright yolu bu çalışma ortamındaki beceri kurulumuna aittir; başka makinelerde import yolunu uyarlayın. `GAME_URL` ile dev/preview adresi değiştirilebilir.

QA gerçek görev adımlarından görüntü alır, sim durumuna faz/konum enjekte etmez. Ekran görüntüleri ve eşleşen telemetri `docs/screenshots/` içindedir; konsol hataları `browser-errors.json` dosyasındadır.
