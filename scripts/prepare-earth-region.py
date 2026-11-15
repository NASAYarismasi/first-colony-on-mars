"""Crop the public-domain NASA BMNG July B1 tile without shipping its 43 MB source."""
from pathlib import Path
from urllib.request import urlretrieve
from PIL import Image

# Reto Stoeckli / NASA Earth Observatory, NASA public-domain media policy.
URL = 'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/july/world.200407.3x21600x21600.B1.jpg'
source = Path('output/earth-b1.jpg')
source.parent.mkdir(exist_ok=True)
if not source.exists():
    urlretrieve(URL, source)
Image.MAX_IMAGE_PIXELS = None
with Image.open(source) as image:
    # B1 covers longitude -90..0, latitude 90..0 at 240 pixels/degree.
    region = image.crop((0, 7200, 12000, 19200))  # -90..-40 E, 10..60 N
    region.resize((4096, 4096), Image.Resampling.LANCZOS).save('public/textures/earth-florida-atlantic.jpg', quality=92)
print('Prepared Florida/Atlantic region: 4096 x 4096')
