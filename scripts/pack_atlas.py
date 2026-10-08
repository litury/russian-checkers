"""Reproducible lossless packing of existing approved pixels; never draws art."""
from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
UI = ROOT / 'src/client/app/ui'
REPORT = ROOT.parent / 'evidence'
REPORT.mkdir(exist_ok=True)
results = []
for directory, excluded in [('clock-frame', set()), ('bunker', {'steam-sheet', 'opening-mask'})]:
    sources = sorted(p for p in (UI / directory).glob('*.webp') if p.stem not in excluded and not p.stem.startswith('atlas'))
    images = [Image.open(p).convert('RGBA') for p in sources]
    width = max(i.width for i in images) + 4
    height = sum(i.height + 4 for i in images)
    atlas = Image.new('RGBA', (width, height))
    frames = {}
    y = 2
    for path, image in zip(sources, images):
        atlas.paste(image, (2, y))
        frames[path.stem] = {'frame': {'x': 2, 'y': y, 'w': image.width, 'h': image.height}, 'rotated': False, 'trimmed': False, 'spriteSourceSize': {'x': 0, 'y': 0, 'w': image.width, 'h': image.height}, 'sourceSize': {'w': image.width, 'h': image.height}}
        y += image.height + 4
    output = UI / directory / 'atlas.webp'
    atlas.save(output, lossless=True, exact=True, method=6)
    decoded = Image.open(output).convert('RGBA')
    for path, image in zip(sources, images):
        f = frames[path.stem]['frame']
        restored = decoded.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h']))
        assert restored.tobytes() == image.tobytes(), path
    assert output.stat().st_size <= 120000, output
    (UI / directory / 'atlas.json').write_text(json.dumps({'frames': frames, 'meta': {'image': 'atlas.webp', 'size': {'w': width, 'h': height}, 'scale': '1'}}, indent=2) + '\n')
    results.append({'group': directory, 'sources': [{'name': p.name, 'bytes': p.stat().st_size, 'size': list(i.size)} for p, i in zip(sources, images)], 'atlas_bytes': output.stat().st_size, 'atlas_size': [width, height], 'rgba_identical': True, 'alpha_identical': True})
(REPORT / 'packing.json').write_text(json.dumps(results, indent=2) + '\n')
print(json.dumps(results, indent=2))
