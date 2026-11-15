# NASA kaynakları ve oyun modeli

## Kaynağı doğrulanan başlıca girdiler

| Oyun girdisi | Doğrulama |
| --- | --- |
| Mars saati, Güneş ve iniş noktası | NASA GISS Mars24 hesapları ve yayımlanmış örnekler. Perseverance inişi 18,44° K ve 77,45° D. Bir sol yaklaşık 24 sa 39 dk 35 sn. [Mars24 algoritması](https://www.giss.nasa.gov/tools/mars24/help/algorithm.html) · [İniş noktası](https://www.giss.nasa.gov/tools/mars24/help/landers.html) |
| Mars yerçekimi ve ışınım | Ekvator yüzey çekimi yaklaşık 3,71 m/s². Mars'ın ortalama uzaklığındaki atmosfer üstü ışınım 586,2 W/m². Panel çıkışı Güneş açısı, Mars–Güneş mesafesi ve oyun modelinin verimlerinden türetilir. [JPL gezegen parametreleri](https://ssd.jpl.nasa.gov/planets/phys_par.html) · [NASA Mars Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html?level=1) |
| Günlük yaşam desteği | Kişi başına 0,84 kg O₂, 3,52 kg içme/yemek hazırlama suyu ve 0,62 kg kuru gıda NASA Ames Tablo 1 ile eşleşir. Su değeri toplam hijyen ve servis suyu ihtiyacını kapsamaz. [NASA Ames Tablo 1](https://ntrs.nasa.gov/citations/20160005782) · [NASA BVAD 2022](https://ntrs.nasa.gov/citations/20210024855) |
| MOXIE | Perseverance üzerinde bir cihaz 16 denemede 122 g O₂ üretti. Tepe hız 12 g/sa, ilk hedef 6 g/sa. Oyun birim başına 6 g/sa kullanır ve 9 cihaz için 54 g/sa hesaplar. [NASA/JPL MOXIE sonuçları](https://www.nasa.gov/solar-system/nasas-oxygen-generating-experiment-moxie-completes-mars-mission/) |
| Perseverance | MMRTG görevin başında yaklaşık 110 W üretiyordu. Oyunun üsse bağlanan şarj iskelesi, hızlandırılmış sürüş saati ve batarya kullanım senaryosu temsili. [NASA/JPL güç basın kiti](https://www.jpl.nasa.gov/news/press_kits/mars_2020/landing/mission/spacecraft/power/) |
| Uçuş donanımı | SLS Block 1’in dört RS-25 ve iki katı yakıtlı hızlandırıcısı ile Orion NASA donanımı. Güdüm, yörüngeler ve transfer oyunda hesaplanır. NTR transfer aracı ve insanlı Mars iniş aracı tasarım çalışmalarıyla kıyaslanan oyun konseptleri. [NASA SLS](https://www.nasa.gov/reference/space-launch-system/) · [Orion](https://www.nasa.gov/wp-content/uploads/2023/02/orion-reference-guide-111022.pdf) · [Mars DRA 5.0](https://ntrs.nasa.gov/citations/20120012928) |
| 3B modeller | Astronot ve EVA eldivenleri NASA 3D Resources'da yayımlanan DigitalSpace Corporation ağına dayanır. NASA/JPL Perseverance modeli yerel olarak kullanılır. [Astronaut](https://science.nasa.gov/3d-resources/astronaut/) · [Perseverance](https://science.nasa.gov/3d-resources/mars-2020-perseverance-rover/) |
| Yüzey radyasyonu | Gale'de Curiosity RAD yüzey referansı yaklaşık 0,64 mSv ve 0,21 mGy / 24 saat. Seyir referansı 1,7 mSv / 24 saat. Jezero'ya uygulanan sabit doz hızı ve habitat için %50 zırhlama oyun varsayımıdır. [NASA RAD özeti](https://ntrs.nasa.gov/citations/20240009831) |

## Sunumda oyun varsayımı olarak belirtilmesi gerekenler

- 3 × 3 MOXIE yerleşimi, 15 kg O₂, 100 L temiz su, 180 kWh batarya ve 420 panelli şebeke ekip tasarımıdır. Su çıkarma verimi, sera pompası, gece aydınlatması ve çalışma eşikleri simülasyon parametreleridir.
- Koloni arazisi temsili Düz Ova sahnesidir. Jezero koordinatları gökyüzü hesabında kullanılır. Aktif yürüyüş zemini gerçek Jezero yükseklik haritası olarak sunulmamalı.
- REG-01 toprağındaki buz ve demir oksit yüzdeleri senaryo verisidir. Gerçek Perseverance numunesi ölçümü olarak kullanılmamalı.
- Tozun güneş enerjisini düşürmesi gözleme dayanır. Oyundaki toz cephesinin başlangıcı, yoğunluğu ve panel temizlik çevrimi sentetiktir. [NASA Opportunity ve 2018 fırtınası](https://www.nasa.gov/image-article/opportunity-emerges-dusty-picture/)
- Oyunun transfer süresi ve iniş hızı simülasyon sonuçlarıdır. NASA ölçümü gibi sunulmamalı. Hesap denklemleri ve model seçimleri [fizik notlarında](PHYSICS.md), görsellerin kökeni [varlık listesinde](../ASSETS.md) yer alır.
