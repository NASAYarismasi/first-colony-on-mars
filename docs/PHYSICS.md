# Uçuş fiziği — Mars’a İlk Koloni

Bu sürüm deterministik bir görev tasarım oyunudur. Kalkış ve iniş hareketi kuvvetlerden sayısal olarak hesaplanır; fazlar süreli görsel animasyonlarla ilerlemez. Aşağıdaki yaklaşımlar ve konsept araçlar, gerçek Artemis veya insanlı Mars uçuşunun yeniden üretildiği anlamına gelmez.

## Mimari, zaman ve birimler

`src/sim/` DOM ve Three.js içermez. `src/data/` araç verilerini, `src/core/` giriş/döngü/olayları, `src/render/` sahneleri, `src/ui/` Türkçe gösterimi taşır. `main.js` bu katmanları bağlar. Fizikte m, s, kg, N, Pa, K ve rad kullanılır. km, km/s, kPa, ton, gün ve g dönüşümleri HUD’da yapılır. Simülasyon telemetrisindeki `acceleration`, `maxAcceleration` ve `peakDeceleration` **m/s²**, `dynamicPressure` ve `maxQ.value` **Pa** cinsindedir.

Döngü adımı Δt = 0,02 s’dir (50 Hz). Biriktirici kalan zamanı saklar; çizim önceki ve güncel fizik örnekleri arasında `alpha` ile enterpolasyon yapar. Kare başına iş bütçesi aşılırsa zaman kuyruğa alınır. Duraklatmada fizik ve erzak saati durur. 1, 2, 5, 10, 50, 1000 ve 100000× hızlandırmalar vardır; 10× üstü yalnızca motor kapalı ve atmosfer dışındayken kabul edilir. Dünya için atmosfer sınırı 120 km, Mars için giriş arayüzü 125 km kabulüdür. Motor ateşlenince en fazla 10×’a dönülür; henüz işlenmemiş gerçek zaman yeni katsayıya çevrilir.

Yörünge ve seyirde kuvvetsiz Kepler çözümü analitiktir. Yüksek hızlandırmada tam 0,02 s katları aynı analitik çözüme topluca verilir; bu yöntem 259 gün için bir milyardan fazla RK4 adımı gerektirmez. Varış sınırında toplu ilerleme kesilir. Yanış, atmosfer ve inişte adımlar 0,02 s olarak kalır.

## Sabitler ve atmosfer

[NASA gezegen bilgi sayfaları](https://nssdc.gsfc.nasa.gov/planetary/factsheet/) ve [JPL astronomi sabitleri](https://ssd.jpl.nasa.gov/astro_par.html) kullanılır. Dünya: μ = 3,986004418×10¹⁴ m³/s², R = 6378137 m, ω = 7,2921159×10⁻⁵ rad/s; Mars: μ = 4,282837×10¹³, R = 3389500 m, ω = 7,088218×10⁻⁵. Güneş μ = 1,32712440018×10²⁰, AU = 149597870700 m. Küresel Dünya için ekvator yarıçapı, Mars için ortalama yarıçap seçilmiştir. Standart g₀ = 9,80665 m/s²’dir.

Dünya atmosferi [US Standard Atmosphere 1976](https://ntrs.nasa.gov/citations/19770009539) jeopotansiyel katmanlarıyla çözülür. Geometrik yükseklik z’den h = Rg z/(Rg+z), Rg = 6356766 m elde edilir. Katman tabanları 0, 11, 20, 32, 47, 51, 71 ve 84,852 km’dir; sonuncusu yaklaşık 86 km geometrik yüksekliğe karşılık gelir. T = Tb + L(h−hb); L ≠ 0 için p = pb(Tb/T)^(g₀/RairL), L = 0 için p = pb exp[−g₀(h−hb)/(RairTb)]. ρ = p/(RairT), a = √(γRairT). 86 km üzeri sürekli, izotermal üstel kuyruktur; termosfer ve uzay hava durumu modeli değildir.

Mars için [NASA Glenn iki bölgeli atmosfer modeli](https://www.grc.nasa.gov/www/k-12/airplane/atmosmrm.html) kullanılır: 7 km altında T°C = −31−0,000998h, üstünde T°C = −23,4−0,00222h; p = 699 exp(−0,00009h) Pa; ρ = p/(192,1T). Giriş arayüzünde negatif Kelvin üretmemek için üst atmosfer sıcaklığı 130 K ile sınırlandırılır. Bu üst atmosfer uzatımı yaklaşıktır. Glenn denklemi yüzeyde **0,01503 kg/m³** verir; sık kullanılan **0,020 kg/m³** başka atmosfer/sıcaklık koşullarına ait yaklaşık değerdir. Test yüzey değerini Glenn denklemiyle doğrular; yoğunluk testi 0,020’ye uysun diye basınç değiştirilmemiştir. Rüzgâr, mevsim ve arazi yüksekliği yoktur.

## Araç, yakıt ve sürükleme

Her kademede kuru kütle, kalan yakıt ve motor tanımı bulunur. Motor sayısıyla çarpılan itki ve özgül itki ortam basıncıyla doğrusal enterpole edilir:

F = Fvac − (Fvac−Fsl) clamp(p/p₀, 0, 1), Isp aynı enterpolasyon; ṁ = F/(Isp g₀).

Gaz kolu sıvı motorların itki ve akışını birlikte ölçekler. SRB katıları gaz kolundan bağımsızdır. Ayrılan kademe hem kuru hem kalan yakıt kütlesiyle sistemden çıkar. Δv = Isp g₀ ln(m₀/m₁), yakıt ihtiyacı m₀[1−exp(−Δv/(Isp g₀))] ile bulunur.

D = ½ρvrel²Cd(M)A; M = vrel/a. Oyun Cd tablosu düşük hızda 0,25, Mach 1’de 0,50, hipersonikte yaklaşık 0,20’dir. Aerodinamik alan ana gövdenin 8,4 m çapından hesaplanır. Bu tablo SLS rüzgâr tüneli verisi değildir; tüm araç için yaklaşık eksenel modeldir.

SLS Block 1 / Artemis I referansı [NASA SLS 2022 kılavuzudur](https://www.nasa.gov/wp-content/uploads/2021/12/sls_reference_guide_2022_web_0.pdf). Kodda her veri ailesinin kaynak yorumu vardır. İki SRB toplam yaklaşık 1252 t yakıt ve 198 t kuru kütledir; her biri yaklaşık 16 MN vakum tepe itki üretir. ~126 s tablo motor yanışını temsil eder; Max-Q civarı çukur ve sonda kuyruk vardır. Tablo yaklaşık olduğundan yaklaşık 2,2 t toplam SRB artığı ayrılır. Isp 242/268 s shuttle kökenli yaklaşık mühendislik değerleridir; ölçülmüş beş segmentli uçuş motoru tablosu olarak sunulmaz.

Ana gövde yaklaşık 987 t yakıt, 85,275 t kuru kütle ve dört RS-25 kullanır. Bir motor için yaklaşık 1,86/2,279 MN ve 366/452 s seçilmiştir ([üretici RS-25](https://www.l3harris.com/all-capabilities/rs-25-engine)). Nominal tam yanış ~480 s’dir; bu görev hedef yörüngeye erişince erken keser. ICPS yaklaşık 3,7 t kuru + 29,048 t yakıt; RL10B-2 110 kN, 465,5 s’dir ([RL10 veri sayfası](https://www.l3harris.com/sites/default/files/2024-07/l3harris-ar-rl10-spec-sheet.pdf)). Vakum motoru için deniz seviyesi alanları aynı sayıya ayarlanmıştır; atmosferde kullanıma uygunluk iddiası yoktur. Orion/servis/adaptör kütlesi 26,52 t, LAS ve koruyucu kapak toplamı yaklaşık 7,6 t seçilmiştir.

## Kalkış ve kılavuzlama

Durum [r, θ, vr, vt] ve her kademenin yakıtıdır. θ eylemsiz açıdır, vt teğetsel hızdır. Hava hızı [vr, vt−ωeffr], ωeff = ωcos(28,627°). [LC-39B](https://www.nasa.gov/centers-and-facilities/kennedy/launch-pad-39b/) enleminden başlangıç doğu hızı yaklaşık 408,246 m/s gelir. Düzlem içi izdüşüm gerçek 28,6° eğimli yörüngeyi çözmez; gezegenin hava dönüşü de aynı etkin açısal hızla alınır.

ṙ = vr, θ̇ = vt/r, v̇r = vt²/r−μ/r²+Fr/m, v̇t = Ft/m−vrvt/r. Yerçekimi ters kare, itki yönü komut edilen pitch açısı, sürükleme bağıl hıza zıttır. Hareket ve yakıt denklemleri aynı RK4 durum vektöründe çözülür. Kılavuzlama her sabit adımda yeniden hesaplanır.

İlk 12 s dik yükseliş, sonraki 8 s küçük pitch-over, 55 km’ye kadar hava hızına hizalanan gravity turn uygulanır. Sonrasında hedef irtifa hatasından istenen vr, vr hatasından radyal ivme hesaplanır; μ/r²−vt²/r yerçekimi/merkezcil dengesi itki yönüne eklenir. Max-Q civarında sıvı motor gaz kolu azaltılır; RS-25 yaklaşık alt güç sınırı korunur ve yük 3,8 g hedefiyle sınırlanır. Bunlar **oyun kılavuzlama kazançlarıdır**, fizik sabitleri değildir.

Bu uçuş doğrudan ~185 km park yörüngesi hedefler. Gerçek Artemis I’in çok eliptik ilk yörüngesi uygulanmaz. Ana motor periapsis 140 km’ye erişince veya yakıtı bitince kapanır; ana gövde ayrılır, 2 s güvenli açıklık sonrası ICPS ateşlenir. Periapsis >180 km ve |vr|<35 m/s olduğunda orbital elemanlardan kapanış kararı verilir. Konum veya hız yörüngeye ışınlanmaz. SRB ayrılması motor yanışına, LAS atımı 80 km irtifaya bağlıdır. `events` kalkış, ayrılmalar, MECO, ICPS ateşleme, yörünge ve Max-Q kaydını taşır. Ayrılmış kademelerin serbest uçuşu çizilmez.

## Yörünge ve gezegenler arası transfer

Özgül enerji ε = v²/2−μ/r; açısal momentum h = r×v; eksantriklik e⃗ = (v×h)/μ−r̂. a = −μ/(2ε), rp = a(1−e), ra = a(1+e). Apoapsis/periapsis telemetrisi gezegen yarıçapı çıkarılmış **irtifadır**; orbital elemanlarda ise merkezden mesafedir. Dairesel ve eğimli yörüngeler için tekil açı durumları işlenir. Vis-viva v = √[μ(2/r−1/a)], periyot 2π√(a³/μ). Eliptik Kepler çözümünde M = E−e sinE Newton yöntemiyle çözülür; hiperbolik/parabolik yayılım desteklenmez.

[NASA yörünge temeli](https://science.nasa.gov/learn/basics-of-space-flight/chapter4-1/) doğrultusunda transfer dairesel, eş düzlemli Dünya ve Mars yörüngelerini kullanır. Mars yarıçapı 1,523679 AU’dur. at = (rE+rM)/2, uçuş süresi π√(at³/μSun), faz açısı π−nMars·tflight. Gezegen dairesel hızları ile transfer elipsi hızları farkından v∞ bulunur. Park yörüngesi manevrası Δv = √(v∞²+2μ/rp)−√(μ/rp). Böylece 200 km Dünya / 250 km Mars için ~258,87 gün, ~44,34°, ~3,61 km/s çıkış, ~2,10 km/s yakalama korunur. Görevde kalkış hedefiyle uyumlu 185 km çıkış hesabı kullanılır.

Mars transit aracı **oyun konseptidir**. Ayrı fırlatmalarla LEO’da önceden kurulmuş kabul edilir; SLS bu 200 t üstü aracı tek seferde taşımaz. [DRA 5.0 NTR araştırmasından](https://ntrs.nasa.gov/citations/20120012928) ~900 s ve 3×25 klbf (~333,6 kN) büyüklüğü alınmıştır. Konseptte 40 t kuru transit, 120 t hidrojen, 40 t iniş aracı; ayrıca Orion ve yaşam desteği stok kütlesi vardır. DRA habitat kütle ölçeği için [TransHab raporu](https://ntrs.nasa.gov/citations/20180008683) kullanılmıştır; bu üç kişilik aracın seçilen toplam kütleleri DRA donanım listesi değildir.

TMI/MOI **patched-conic darbeli manevra yaklaşımıdır**: yakıt ve yanış süresi gerçek F/(Isp g₀) akışından, tamamlanma biriken roket denklemi Δv’sinden gelir. Yanış fazı sabit süre sayacı değildir. Ancak bu süre boyunca gerçek sonlu yanış yörüngesi, Oberth/yerçekimi kayıpları ve yönlendirme çözülmez; manevra sonunda ideal transfer / 250 km Mars dairesel referansına geçilir. Yanış telemetrisindeki park yörüngesi konumu referanstır. Bu yaklaşımın sonlu yanış hatası özellikle uzun NTR ateşlemelerinde önemlidir. Takvim bazlı ephemeris, gerçek fırlatma penceresi, radyasyon, hidrojen boil-off ve dönüş uçuşu kapsam dışıdır.

## Mars yörüngesinden çıkış, giriş ve iniş

Varsayılan giriş doğrudan hiperbolik varış değildir: MOI sonrası 250 km dairesel yörüngeden, apoapsisi 250 km ve periapsisi −50 km olan elipse darbeli deorbit yapılır. Δv vis-viva farkıyla bulunur ve lander yakıtından düşülür. Elips Kepler ile yaklaşık 1440 s izlenip 125 km giriş arayüzünde **aynı durum vektörü** EDL’ye aktarılır. Bağımsız EDL testinde bu elipsin giriş hızı analitik hesaplanır (~3,47 km/s eylemsiz). Deorbit darbesinin sonlu motor süresi çözülmez.

İniş aracı **oyun varsayımıdır**: 24 t kuru, 16 t yakıt, 800 kN throttleable motor, Isp 360 s, 15 m aerodinamik çap, Cd=1,5, L/D=0,24 ve 7,5 m burun yarıçapı. [NASA insanlı Mars SRP araştırmasındaki](https://ntrs.nasa.gov/citations/20210010609) 40–65 t giriş kütlesi ölçeği bağlam sağlar. NASA insanlı ölçekte [süpersonik retropropulsion](https://www.nas.nasa.gov/SC21/research/project13.html) araştırır; robotik görev paraşütleri bu kütlede yeterli temel çözüm sayılmadığından paraşüt kullanılmaz. Seçilen motor ve termal kalkan uçuşta doğrulanmış donanım değildir.

β = m/(CdA), D = ½ρvrel²CdA, L = 0,24D; kaldırma, hız vektörüne dik yukarı yönlüdür. Otopilotun bank çarpanı girişte 0,35 (etkin L/D=0,084), motorlu bölümde 0’dır; bu basit kontrol skip-out eğilimini azaltır. Mars atmosferinin dönmesi sürükleme hesabında kullanılır. Hareket ve yakıt RK4 ile birlikte ilerler.

Sutton–Graves ısı göstergesi q̇ = k√(ρ/rn)v³, kMars = 1,9027×10⁻⁴, SI ile W/m²; [NASA giriş modeli kaynağı](https://ntrs.nasa.gov/citations/20080013535). Tepe akı ve ∫q̇dt raporlanır; ısı kalkanı ablasyonu, sıcaklık ve yapısal hasar çözülmez.

SRP, h<15 km ve h<1,4·dstop+2 km koşulunda başlar; dstop = vrel²/[2(Fmax/m−g)]. Atmosferik frenlemeye fırsat vermek için erken ateşleme engellenir. Motor komutu yatay bağıl hızı sıfıra götürür, düşey hedefi irtifayla azaltır; son 50 m’de hedef yumuşatılır ve yerde 1,2 m/s istenir. Motorlar ideal sürekli gaz kolludur; asgari itki, gimbal ve engine-out modellenmez. Otopilotun gecikmesiyle gerçek temas yaklaşık 1,50 m/s’dir. `altitude<=0` kesişimi adım içinde enterpole edilir; çarpma hızı korunur, sıfırlanmaz. Toplam yüzeye bağıl hız <2,5 m/s ise güvenli iniş, aksi durumda `FAILED` olur. Tepe yük m/s² olarak raporlanır. Yakıtsız inişin başarısız olduğu ayrıca test edilir.

<!-- INIS: EDL presentation/debris additions; main force model is unchanged. -->
İniş görselleştirmesi, [NASA DRA 5.0](https://ntrs.nasa.gov/citations/20090012109) insanlı görev bağlamı ve [insan ölçekli SRP araştırması](https://ntrs.nasa.gov/citations/20200002811) ile ilişkilendirilir. Mevcut görevde yakalama motorludur; aerocapture hesaplanıyormuş gibi gösterilmez. Giriş plazması ve ısınma parıltısı mevcut Sutton–Graves akısından, araç/motor yönü ise otopilotun radyal/teğetsel itki ivmesinden okunur.

SRP eşiğinde bir kez `HEATSHIELD_JETTISON` üretilir. Ayrılan kalkan bağımsız RK4 izidir: ters kare Mars yerçekimi ve dönen atmosferde sürükleme içerir. **Oyun varsayımları:** 1200 kg iz kütlesi, Cd=1,2, mevcut giriş alanı, 1,6 m radyal konum ofseti, −5 m/s radyal ve +10 m/s teğetsel ayrılma darbesi. Küresel yüzey kesişimi adım içinde enterpole edilir, ardından iz durur. Ana aracın önceden tanımlı toplam kütlesi/aerodinamiği korunur; bu kalkan izi ikinci bir donanım kütlesi çıkarımı değildir. Kalkan ablasyonu, egzoz etkileşimi ve ayrıntılı arazi çarpışması çözülmez.

**Oyun varsayımı:** motorlu inişte ≤1000 m'de bir kez `LEGS_DEPLOYED` açılma komutu üretilir; görsel açılma üç simülasyon saniyesinde tamamlanır. Kuvvetler ve güvenli temas eşiği değişmez. Motor tozu son 30 m'de başlar; oyuk/iz ve çöken toz görsel yaklaşımdır. Temas sonrası yaklaşık altı gerçek saniyelik koloni geçişi, duran görev saatini veya erzak miktarını ilerletmez ve hızlandırmayla kısalmaz. Mevcut iniş JSON'u aynen aktarılır.
<!-- END INIS. -->

## Görev, erzak ve ortak iniş JSON’u

`PRELAUNCH → ASCENT → PARKING_ORBIT → TMI_BURN → CRUISE → MOI_BURN → MARS_ORBIT → DEORBIT → EDL → LANDED`; herhangi bir aşama `FAILED` olabilir. Park yörüngelerinde bekleme gerçek görev zamanıdır; kullanıcı **B** ile manevrayı başlatır. MOI fiziksel Hohmann varışında otomatik başlar. **T** güvenli hızlandırmayı, **P** duraklatmayı seçer. API: `launch`, `setThrottle`, `stage`, `burn`, `abort`, `setWarp`, `getTelemetry`. Erken kademe atımı güvenli ayrılma kabulüyle reddedilir; `stage()` yalnızca tükenmiş katıyı ayırır, otomatik olaylar normal uçuşu yönetir.

[NASA Ames yaşam desteği referansı, Tablo 1](https://ntrs.nasa.gov/citations/20160005782): kişi başına günlük yaklaşık O₂ 0,84 kg, içme/yemek hazırlama suyu 3,52 kg, kuru gıda 0,62 kg. Kütle zamanla `rate × crew × dt/86400` kadar azalır; su geri dönüşümü veya oksijen rejenerasyonu kredisi yoktur. Transit manevra hesabında stok kütlesi dahildir; tüketilen kütle sistemden uzaklaştırılmış kabul edilir, atık depolama modellenmez. 259 günde üç kişi **652,68 kg O₂, 2735,04 kg su, 481,74 kg gıda** tüketir. Başlangıç 320 mürettebat-günlük stok (oyun seçimi); herhangi bir kaynak biterse görev başarısız, sağlık sıfır olur. Sağlık bunun dışında 100’dür; ayrıntılı tıbbi model yoktur.

`landingPayload.js` README’nin alanlarını aynen üretir: `crew`, `supplies`, `modules`, `landingSite`, `surfaceEnergy`. `supplies` içinde `food`, `water`, `oxygen`, `spareParts` korunur. **1 oyun erzak birimi, tüm mürettebatın o kaynağa ait 1 günlük gereksinimidir.** Her alan kalan kg/(kişi başı oran × kişi sayısı) olarak çevrilir, kesirler korunur; README’deki 12 sayısı hedef olarak zorlanmaz. Yalnızca 259 günlük tüketim sonrası 320−259=61 birim kalır; gerçek uçuş/yanış/bekleme/iniş süreleri ek tüketim yapar. Modüller, başlangıç yedek parçası ve yüzey enerjisi README örneğine dayanan oyun envanteridir. `flat` için 8, diğer alan için 6 enerji seçimi fiziksel arazi hesabı değildir. Gerçek araziye bağlı iniş maliyeti sonraki görevdir. Teslim nesnesi canlı durumu paylaşmaz.

## Gerçek veri / Yaklaşık / Oyun varsayımı

| Kalem | Gerçek veri | Yaklaşık | Oyun varsayımı |
|---|---|---|---|
| Gezegenler | NASA/JPL μ, yarıçap, dönme; IAU AU | Küresel iki cisim | KSC dönüşünün düzleme izdüşümü |
| Dünya atmosferi | USSA 1976 katmanları | 86 km üstü üstel kuyruk | Rüzgârsız hava |
| Mars atmosferi | Glenn basınç/sıcaklık bağıntısı | Üst atmosfer 130 K tabanı | Sabit mevsim/zemin |
| SLS | NASA Block 1 geometri ve motor referansları | Kütleler, SRB eğrisi/Isp, LAS/adaptör muhasebesi | Cd tablosu, doğrudan LEO profili, kontrol kazançları |
| Yörünge | Newton/Kepler, vis-viva | J2 ve üçüncü cisim yok | Park hedefi ~185 km |
| Transfer | Hohmann ve roket denklemi | Dairesel/eş düzlemli gezegenler, darbeli manevra | Önceden kurulmuş NTR ve stok/mass bütçesi |
| Mars inişi | Kuvvet integrasyonu, Sutton–Graves bağıntısı | Noktasal araç, sabit Cd, basit bank, termal gösterge | 40 t lander, ideal throttle, otopilot kazançları |
| Yaşam desteği | NASA metabolik ihtiyaç ölçeği | Sabit günlük oran, atık depolaması yok | 3 kişi, 320 gün stok, kg→oyun birimi |
| Koloni devri | README alan sözleşmesi | — | Modül envanteri, sağlık, yüzey enerjisi |

## Doğrulama

### Task 3 arayüz eki

Uçuş sabitleri, tüketim oranları, kuvvet denklemleri ve iniş verisi sözleşmesi korunmuştur. `cabinPower` sim durumunda/telemetride açık-kapalı kabin veri yoludur (oyun varsayımı, başlangıçta açık); güç yükü, kWh veya batarya ömrü hesaplanmaz. Kol bilgisayarı kalan erzak günlerini mevcut kg ve mevcut mürettebat tüketiminden hesaplar. Negatif periapsis irtifası arayüzde “yörünge altı” diye işaretlenir; sim değeri değiştirilmez. Açık yörüngede sonlu apoapsis gösterilmez.

### Task 2 görsel katman eki

Görsel yenilemede uçuş kuvvetleri, görev geçişleri ve iniş JSON'u değiştirilmedi. Render için `pressure`, `density`, `thrust` ve EDL'de anlık `heatFlux` telemetriye eklendi. EDL `acceleration` alanı son motor komutunu da içeren toplam yerçekimi dışı ivmeyi bildirir; SRP itkisinin g göstergesine katıldığı ayrı testle doğrulanır.

`countdown.js` saf T−10 / RS-25 T−6,5 / SRB T0 sekansıdır; T0'da mevcut `mission.launch()` çağrılır. Terminal motor çalıştırma süresinde ana uçuşun yakıtı harcanmaz. `debris.js` ana aracı etkilemeyen, testli ters-kare balistik ayrılma parçaları üretir; ayrılma impulsları ve sabit dönme hızları oyun varsayımıdır. Bu modül önceki metindeki “ayrılmış kademeler çizilmez” sınırının yerini alır.

NASA gündüz/gece Dünya, Viking Mars ve gerçek kataloglardan üretilmiş 4K SVS yıldız dokuları eklendi. Eski aşağıdaki görsel prototip notları Task 1'in doğrulama kaydıdır; güncel çizim mimarisi ve sınırlar [RENDERING.md](RENDERING.md) dosyasındadır. Fizik dışı kabin güç görevi/yürüme etkileşimi yerine doğrudan uçuş kontrolü kullanılır.

`npm test` atmosfer referanslarını, katman sürekliliğini, orbital eleman dönüşümünü, 10 yörünge boyunca <10⁻⁹ enerji hatasını, yakıt/kademe muhasebesini, tam kalkışı, yarım adım yakınsamasını, transferi, EDL güvenli/başarısız inişi, 259 günlük erzağı, tüm görev zincirini, hızlandırma güvenlik geçişini, giriş ve olay aboneliğini sınar. `npm run build` üretim derlemesidir. `window.advanceTime(ms)` aynı sabit adımları sürer ve istenen ilerlemenin bütün iş kuyruğunu tamamlar; `render_game_to_text()` SI telemetriyi ve etkileşim durumunu döndürür. Normal RAF döngüsünde iş bütçesi dolarsa `backlogSeconds` kalan zamanı gösterir. Yeni dış varlık eklenmemiştir; eski NASA GLB’leri ve programatik geometri korunur.

Varsayılan referans koşusu: Max-Q **56,58 s / 29,01 kPa**, SRB ayrılması **126,02 s**, yörüngeye giriş **469,02 s**, **180,04 × 195,87 km**, maksimum yük **3,8006 g**. Bağımsız EDL: **1,5003 m/s** temas, yaklaşık **4,96 t** yakıt; deorbit yakıtı dahil tam görevde inişte yaklaşık **4,39 t** kalır. Tam görev tarayıcıda WASD/E, kamera, kabin gücü, Q, P, B, T, varışta hızlandırma sınırı ve sıfırlama ile doğrulandı; ekran görüntüleri incelendi, yeni sayfa/konsol hatası görülmedi. Görseller eski prototip düzeyinde bırakılmıştır; Orion modeli Mars lander için geçici yer tutucudur.
