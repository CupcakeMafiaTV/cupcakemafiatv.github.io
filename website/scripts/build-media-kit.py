from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from PIL import Image
import shutil

import json
import argparse
from datetime import datetime
from zoneinfo import ZoneInfo
import reportlab

repo = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description='Build the public media kit from verified audience data.')
parser.add_argument('--output', type=Path, default=repo / 'static/downloads/cupcakemafiatv-media-kit.pdf')
args = parser.parse_args()
output = args.output.resolve()
output.parent.mkdir(parents=True, exist_ok=True)
snapshot = json.loads((repo / 'data/audience_snapshot.json').read_text(encoding='utf-8'))
zone = ZoneInfo('America/Toronto')
prepared = datetime.fromisoformat(snapshot['preparedAt'].replace('Z', '+00:00')).astimezone(zone)
prepared_label = prepared.strftime('%B ') + str(prepared.day) + prepared.strftime(', %Y')
font_dir = Path(reportlab.__file__).parent / 'fonts'
for name, filename in [('Segoe', 'Vera.ttf'), ('SegoeBold', 'VeraBd.ttf'), ('SegoeSemi', 'VeraBd.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(font_dir / filename)))
c = canvas.Canvas(str(output), pagesize=(612, 792))
c.setTitle('CupcakeMafiaTV | Media Kit')
c.setAuthor('CupcakeMafiaTV')
c.setSubject('Gaming content creator and partnership overview - ' + prepared_label)
bg, panel, lavender, white, muted = map(HexColor, ['#15111d', '#25182f', '#b48aff', '#f5f2f8', '#c7bad2'])
c.setFillColor(bg); c.rect(0, 0, 612, 792, fill=1, stroke=0)

def label(text, x, y, size=11, color=white, font='Segoe'):
    c.setFillColor(color); c.setFont(font, size); c.drawString(x, y, text)

def paragraph(text, x, top, width, size=11, leading=16, color=muted):
    p = Paragraph(text, ParagraphStyle('body', fontName='Segoe', fontSize=size, leading=leading, textColor=color))
    _, height = p.wrap(width, 500)
    p.drawOn(c, x, top - height)
    return height

def card(x, y, width, height):
    c.setFillColor(panel); c.setStrokeColor(HexColor('#5a426a')); c.setLineWidth(.6)
    c.roundRect(x, y, width, height, 8, fill=1, stroke=1)

label('CREATOR MEDIA KIT', 40, 744, 10, lavender, 'SegoeBold')
label('CupcakeMafiaTV', 40, 706, 29, white, 'SegoeBold')
label('Cody  /  Ontario, Canada', 40, 679, 12, muted)
label('League of Legends mid laner & variety streamer', 40, 654, 11, white, 'SegoeSemi')
label('Streaming since 2016  |  Solo queue peak: Master 96 LP', 40, 634, 10, muted)

photo = Image.open(repo / 'themes/cupcakemafiatv/static/img/CodyAboutMe.webp').convert('RGB')
# Crop a square portrait inside the existing site's image frame.
w, h = photo.size
side = min(w, h)
photo = photo.crop(((w-side)//2, max(0, (h-side)//3), (w+side)//2, max(0, (h-side)//3)+side))
photo.thumbnail((420, 420))
c.saveState()
clip = c.beginPath(); clip.roundRect(458, 637, 114, 114, 8)
c.clipPath(clip, stroke=0, fill=0)
c.drawImage(ImageReader(photo), 458, 637, 114, 114)
c.restoreState()

paragraph('Ranked climbs, community events and a shared love of games. I partner with brands and developers on new titles, launches and integrated campaigns that fit my audience.', 40, 605, 532, 11, 17)
label('Audience & Reach', 40, 526, 19, white, 'SegoeBold')
label('Prepared: ' + prepared_label, 40, 505, 10, muted)
definitions = [('twitch', 'Twitch', '#b48aff'), ('youtube', 'YouTube', '#ff5867'), ('x', 'X', '#f5f2f8'), ('instagram', 'Instagram', '#e98ac1'), ('tiktok', 'TikTok', '#8ee4df'), ('discord', 'Discord', '#9798ff')]
stats = []
for key, title, color in definitions:
    entry = snapshot['platforms'][key]
    value = format(entry['count'], ',') if isinstance(entry.get('count'), int) and entry['count'] >= 0 else 'n/a'
    checked = datetime.fromisoformat(entry['verifiedAt'].replace('Z', '+00:00')).astimezone(zone).strftime('%Y-%m-%d') if entry.get('verifiedAt') else 'Not verified'
    stats.append((title, value, entry['unit'], color, checked))
for i, (platform, value, unit, color, checked) in enumerate(stats):
    x = 40 + (i % 3) * 182; y = 398 - (i // 3) * 93
    card(x, y, 168, 79)
    label(platform, x+13, y+57, 10, HexColor(color), 'SegoeSemi')
    c.setFillColor(muted); c.setFont('Segoe', 7); c.drawRightString(x+155, y+57, checked)
    label(value, x+13, y+27, 25, white, 'SegoeBold')
    label(unit, x+13, y+12, 9, muted)
label('Check dates shown above. Platform audiences may overlap.', 40, 287, 9, muted)

label('Ways to Work Together', 40, 251, 19, white, 'SegoeBold')
offers = [
    ('Dedicated Stream Segment', 'Feature your brand live on stream.'),
    ('Multi-Platform Shoutouts', 'Share your campaign across my platforms.'),
    ('VOD & Highlight Placement', 'Include your brand in VODs and highlight clips.'),
    ('Direct Collaboration', 'Work with me from planning to launch.')
]
for i, (title, body) in enumerate(offers):
    x = 40 + (i % 2) * 273; top = 225 - (i // 2) * 49
    label(title, x, top, 11, white, 'SegoeSemi')
    paragraph(body, x, top-9, 253, 9.5, 13)

c.setStrokeColor(lavender); c.setLineWidth(.8); c.line(40, 128, 572, 128)
label("Let's Talk", 40, 102, 18, white, 'SegoeBold')
label('cupcakemafiatvgaming@gmail.com', 40, 79, 11, white)
c.linkURL('mailto:cupcakemafiatvgaming@gmail.com', (40, 75, 285, 91), relative=0)
label('cupcakemafiatv.com', 40, 59, 10, lavender)
c.linkURL('https://cupcakemafiatv.com/', (40, 55, 153, 70), relative=0)
label('Watch on Twitch', 458, 83, 10, lavender, 'SegoeSemi')
c.linkURL('https://www.twitch.tv/cupcakemafiatv', (458, 79, 572, 96), relative=0)
label('YouTube', 458, 63, 10, lavender, 'SegoeSemi')
c.linkURL('https://www.youtube.com/@cupcakemafiatv', (458, 59, 572, 75), relative=0)
c.showPage(); c.save()
print(output)
