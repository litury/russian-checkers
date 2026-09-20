"""Deterministic registered extraction, Pillow only. Never modifies gate.png.
Masks: one x(y) seam; complementary halves intersect the housing aperture.
4x box coverage AA keeps every original RGB/bevel pixel, no inpainting.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops, ImageStat
import json, hashlib
ROOT = Path(__file__).resolve().parent
source = Image.open(ROOT / 'gate.png').convert('RGBA')
w, h = source.size
S = 4
# Midpoint of the dark mating channel, BETWEEN both original metal bevels.
seam = [(770,0),(770,164),(729,194),(729,300),(788,336),(788,423),
        (737,454),(737,557),(787,589),(787,679),(729,716),(729,809),
        (770,838),(770,1024)]
# Fixed jamb hardware protrudes over the leaves at the horizontal locking rails.
left_edge = [(310,82),(310,160),(242,191),(242,430),(289,430),
             (327,470),(327,550),(289,585),(242,585),(242,834),
             (310,900),(310,915),(241,915),(241,984)]
right_edge = [(1536-x,y) for x,y in left_edge]
aperture = left_edge + list(reversed(right_edge))
left_polygon = [(0,0)] + seam + [(0,h)]
right_polygon = [(w,0)] + seam + [(w,h)]
def polygon(points):
    im = Image.new('L',(w*S,h*S)); ImageDraw.Draw(im).polygon([(x*S,y*S) for x,y in points], fill=255)
    return im
opening = polygon(aperture)
lhs = polygon(left_polygon)
# Exact binary complement BEFORE downsampling. Shared seam, never two authored cuts.
rhs = ImageChops.invert(lhs)
masks = {'left': ImageChops.multiply(opening,lhs), 'right': ImageChops.multiply(opening,rhs), 'frame': ImageChops.invert(opening)}
layers = {}
for name, mask in masks.items():
    mask = mask.resize((w,h),Image.Resampling.BOX)
    mask.save(ROOT / f'gate-{name}-mask.png')
    layer = source.copy(); layer.putalpha(mask)
    # Discard only invisible RGB for compression; all alpha > 0 source pixels unchanged.
    layer.paste((0,0,0,0),(0,0,w,h),mask.point(lambda a: 255 if a == 0 else 0))
    layer.save(ROOT / f'gate-{name}.png'); layers[name] = layer
composite = Image.new('RGBA',(w,h),(22,26,27,255))
for name in ['left','right','frame']: composite = Image.alpha_composite(composite,layers[name])
diff = ImageChops.difference(composite.convert('RGB'),source.convert('RGB'))
stat = ImageStat.Stat(diff)
manifest = {'source':'gate.png','source_sha256':hashlib.sha256((ROOT/'gate.png').read_bytes()).hexdigest(),
 'canvas':[w,h],'css_size':[1440,960],'seam_xy':seam,'aperture_polygon':aperture,
 'left_polygon':left_polygon,'right_polygon':right_polygon,'complement':'right = 255 - left at 4x; frame = 255 - aperture',
 'alpha':'4x coverage antialias, unchanged source RGB; source-over has subpixel boundary attenuation',
 'closed_reconstruction':{'layer_source_over_rgb_mae':sum(stat.mean)/3,'layer_source_over_max_channel_error':max(v[1] for v in diff.getextrema()),'runtime_closed':'original decoded master until departure: exact, RGB error 0'},
 'hidden_surfaces':'None invented. Leaves slide behind the fixed jamb; no perspective rotation or exposed backs.',
 'fixed_frame':'Outer lintel, floor, side jambs and locking-rail mounts. Removed only at transition completion.'}
(ROOT/'gate-masks.json').write_text(json.dumps(manifest,indent=2)+'\n')
out = ROOT.parents[4]/'docs'/'preview-siege-toothed-opening'
out.mkdir(parents=True,exist_ok=True)
composite.save(out/'closed-layer-reconstruction.png')
# Offline extraction evidence, explicitly NOT browser/game screenshots.
for dx in [80,240,500]:
    view=Image.new('RGBA',(w,h),(0,0,0,0))
    view.alpha_composite(layers['left'],(-dx,0)); view.alpha_composite(layers['right'],(dx,0))
    view.alpha_composite(layers['frame']); view.save(out/f'extraction-open-{dx}.png')
print(json.dumps(manifest['closed_reconstruction'],indent=2))
