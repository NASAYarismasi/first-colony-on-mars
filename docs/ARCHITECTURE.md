# Gösterilen görev mimarisi

Bu görev, [NASA Mars DRA 5.0 (NTRS 20090012109)](https://ntrs.nasa.gov/citations/20090012109) içindeki ön konuşlandırma ve yörüngede birleştirme fikrini Artemis donanımıyla birleştiren bir **oyun konseptidir**. DRA'nın birebir uçuş planı veya onaylı NASA insanlı Mars aracı değildir.

SLS Block 1 yalnızca Orion'u fırlatır. **GAME ASSUMPTION:** NTR kademesi, hidrojen tankları, transit habitatı ve aeroshell içindeki Öncü iniş aracı ayrı uçuşlarla önceden Dünya yörüngesine getirilmiştir. Orion park yörüngesinde üst bağlantı noktasına yanaşır. Aynı Orion gövdesi, malzemeleri ve dört ESM güneş kanadı kalkışta ve transit sırasında kullanılır; park yörüngesindeki 12 saniyelik yanaşma yalnızca görsel bir sadeleştirmedir.

TMI yanışı, seyir ve motorlu Mars yörünge yakalaması (MOI) boyunca birleşik Mars Transit Aracı (MTV) görülür. NTR modeli; üç reaktör/motor, gölge kalkanı, hidrojen tankları, radyatörler ve ayrı güneş panelleri içerir. Kaynak: [NASA DRA NTR araç çalışması](https://ntrs.nasa.gov/citations/20120012928). Reaktör hidrojeni ısıtır; kimyasal yanma yoktur ([NASA nükleer itki açıklaması](https://www.nasa.gov/space-technology-mission-directorate/tdm/space-nuclear-propulsion/)). Çok soluk mavimsi egzoz bir görünürlük varsayımıdır; büyük turuncu alev gösterilmez. Orion'un dört kanadı ve yaklaşık 19 m açıklığı [ESA ESM](https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Orion/European_Service_Module) referansına dayanır. MTV'nin geometrisi, radyatör yerleşimi ve ayrıntı ölçüleri **GAME ASSUMPTION**'dır; simülasyon kütle/itki değerleri değişmez.

Mars yörüngesinde mürettebatın Öncü'ye geçtiği kabul edilir. Deorbit komutunda aeroshell içindeki **aynı** iniş aracı MTV'den ayrılır; Orion, habitat ve NTR önceki dairesel yörüngede kalır. Yerel çizimdeki ayrılma, bu dairesel yörüngenin gerçek deorbit durumuna göre farkından hesaplanır. Araç simülasyonun girişiyle atmosferde yavaşlar. Kalkan atım olayında ısı kalkanı ve backshell çıkar; süpersonik retro-itki, bacak açılması ve temas gerçekleşir. Koloninin kullandığı model aynı `createMarsLander()` geometrisidir.

**GAME ASSUMPTION:** backshell ve ısı kalkanı tek atım olayında mevcut kalkanın simüle edilen enkaz izini paylaşır. Bağımsız ikinci enkaz fiziği, radyasyon/boil-off modeli, ayrıntılı kenetlenme dinamiği veya dönüş uçuşu yoktur. Giriş aerocapture değildir; önce NTR ile MOI yapılır. Orion kabini seyirde ve Mars yörüngesinde, iniş penceresi deorbit/EDL sırasında seçilir.

| Sim fazı | Görülen araç/parçalar |
| --- | --- |
| PRELAUNCH, ASCENT | SLS + aynı Orion/ESM; bağlı SRB, ana kademe, ICPS ve LAS sim durumuna göre |
| PARKING_ORBIT | Önceden kurulmuş MTV + kapalı Öncü aeroshell'i; Orion yaklaşır ve kenetlenir, paneller açılır |
| TMI_BURN | Birleşik MTV + Orion + kapalı Öncü; üç soluk NTR egzozu |
| CRUISE | Aynı birleşik araç; ESM ve habitat güneş panelleri açık, motorlar kapalı |
| MOI_BURN | Aynı birleşik araç; NTR yeniden yanar |
| MARS_ORBIT | Aynı birleşik araç; mürettebat transferine hazır |
| DEORBIT | Aynı Öncü + aynı aeroshell ayrılır; MTV/Orion dairesel yörüngede uzaklaşır |
| EDL | Öncü + aeroshell; kalkan atım olayından sonra aynı çıplak iniş aracı, SRP ve açılan bacaklar |
| LANDED | Aynı Öncü; bacaklar ve merdiven açık, koloninin yüzey modeli |
| FAILED | Son geçerli fazın araç yapısı korunur |
