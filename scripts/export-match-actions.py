"""Lossless integer crops only. No resampling, alpha thresholding, or painting.
Run with the approved final-art directory as argv[1]. State windows share a
384x160 canvas and identical registration; faint source pixels are retained.
"""
import hashlib
import json
import sys
from pathlib import Path
from PIL import Image

source = Path(sys.argv[1]) / 'atlas-correction-original.png'
out = Path(__file__).resolve().parents[1] / 'src/client/app/ui/match-actions'
im = Image.open(source).convert('RGBA')
regions = {}
for kind, x in [('undo', 18), ('resign', 392)]:
    for state, y in zip(['rest', 'hover', 'pressed', 'focus', 'disabled'], [90, 250, 410, 570, 730]):
        regions[f'{kind}-{state}'] = [x, y, x + 384, y + 160]
regions.update({'dialog': [768, 74, 1536, 566], 'undo-icon': [810, 596, 1120, 906], 'resign-icon': [1180, 596, 1490, 906]})
for name, box in regions.items():
    im.crop(box).save(out / f'{name}.png')
(out / 'provenance.json').write_text(json.dumps({'source': source.name, 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'operation': 'integer RGBA crop; original alpha retained; no resampling or painting', 'registered_button_canvas': [384,160], 'regions_xyxy': regions}, indent=2) + '\n')
