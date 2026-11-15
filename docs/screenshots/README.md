# Görev görüntüleri

Görüntüler Playwright Chromium / ANGLE SwiftShader ile 1440×900 çözünürlükte gerçek simülasyon adımlarından alındı. Komutlar normal oyun kontrolleridir; faz, konum veya hız enjekte edilmedi. Her PNG'nin aynı adlı JSON'u SI telemetriyi, kamera bilgisini ve render sayaçlarını içerir.

| Görüntü | İçerik |
|---|---|
| [00-title.png](00-title.png) | Sinematik rampa üzerinde Türkçe ana menü |
| [00-about.png](00-about.png) | Emre, İhan, Samet ve veri/görsel kaynakları |
| [00-controls.png](00-controls.png) | Türkçe kontroller; Q kol bilgisayarı |
| [01-pad-chase.png](01-pad-chase.png) | T−10, LC-39B, takip kamerası |
| [02-liftoff-ground.png](02-liftoff-ground.png) | T+8 s, ~2,4 km uzaktan yer takibi, net kule/Atlantik ufku, negatif PE yerine “yörünge altı” |
| [03-max-q-chase.png](03-max-q-chase.png) | Yaklaşık T+56,6 s / 29,0 kPa, Max-Q |
| [04-srb-separation.png](04-srb-separation.png) | T+128,8 s, balistik ayrılan SRB'ler |
| [04-wrist-computer.png](04-wrist-computer.png) | Q cihazı: sim saat/fazı, erzak günleri, kabin gücü, sonraki olay |
| [05-orbit-onboard.png](05-orbit-onboard.png) | Kamera 2, yaslanmış koltuklarda bükülü diz/kol pozuyla üç mürettebat |
| [06-cruise-departure.png](06-cruise-departure.png) | Başlangıçta bitişik Dünya/mürettebat için ayrı etiketler, tüm transfer elipsi ve Mars varış halkası |
| [06-cruise-map.png](06-cruise-map.png) | ~109. gün, gerçek sim konumları, düz uçulan yay / kesikli elips |
| [06-cruise-wrist.png](06-cruise-wrist.png) | ~109. günde güncel konumlarla kol bilgisayarı, kalan ~210 günlük erzak |
| [07-edl-plasma.png](07-edl-plasma.png) | ~65,7 km, Mach 17,3, 18 kW/m² anlık ısı akısı |
| [08-touchdown.png](08-touchdown.png) | Mars yüzeyi, 1,50 m/s güvenli temas |
| [09-earth-orbit-map.png](09-earth-orbit-map.png) | Ek: Dünya yörüngesi, gerçekleşen iz ve öngörülen yörünge |
| [10-powered-descent.png](10-powered-descent.png) | Ek: ~35 m, retro egzoz ve son yaklaşma |
| [11-core-separation.png](11-core-separation.png) | Ana kademe ayrıldıktan sonra fiziksel parça ve ICPS/Orion HUD şeması |

Son doğrulama: **42 Vitest testi**, üretim derlemesi, tam uçuş/iniş, ana menü/kaynaklar/kontroller, Q cihazı, kademe şeması ve deterministik çizim zamanı kontrolleri geçti. [Tarayıcı hata kaydı](browser-errors.json) boştur. Kare hızı sayıları yazılım tabanlı SwiftShader'a aittir; gerçek dizüstü GPU performansı ölçülmedi. Görsel/model sınırlamaları [RENDERING.md](../RENDERING.md), lisanslar [ASSETS.md](../../ASSETS.md) içinde.
