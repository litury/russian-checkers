from pathlib import Path
from PIL import Image, ImageChops
import json, hashlib
import sys
root=Path(__file__).resolve().parents[1]
assets=root/'src/client/app/ui/match-actions'
# Usage: python3 scripts/export-match-actions-atlas.py OUTPUT_DIRECTORY
# PNG masters are untouched. RGBA equality is to the same-size resized reference.
out=Path(sys.argv[1]); out.mkdir(parents=True,exist_ok=True)
states=['rest','hover','pressed','focus','disabled']
report=[]
for scale in [2,3]:
    w,h,p=96*scale,40*scale,2*scale
    for kind in ['undo','resign']:
        atlas=Image.new('RGBA',(w+2*p,5*(h+2*p)))
        originals=[]
        for i,state in enumerate(states):
            src=assets/f'{kind}-{state}.png'
            im=Image.open(src).convert('RGBA')
            resized=im.resize((w,h),Image.Resampling.LANCZOS)
            atlas.paste(resized,(p,i*(h+2*p)+p))
            # Extruded edge padding protects the cell during filtered scaling.
            for x in range(p):
                atlas.paste(resized.crop((0,0,1,h)),(x,i*(h+2*p)+p))
                atlas.paste(resized.crop((w-1,0,w,h)),(p+w+x,i*(h+2*p)+p))
            for y in range(p):
                atlas.paste(atlas.crop((0,i*(h+2*p)+p,w+2*p,i*(h+2*p)+p+1)),(0,i*(h+2*p)+y))
                atlas.paste(atlas.crop((0,i*(h+2*p)+p+h-1,w+2*p,i*(h+2*p)+p+h)),(0,i*(h+2*p)+p+h+y))
            originals.append((src,resized))
        dest=out/f'{kind}-atlas-{scale}x.webp'
        atlas.save(dest,lossless=True,exact=True,method=6)
        decoded=Image.open(dest).convert('RGBA')
        for i,(src,resized) in enumerate(originals):
            cell=decoded.crop((p,i*(h+2*p)+p,p+w,i*(h+2*p)+p+h))
            assert cell.tobytes()==resized.tobytes()
            assert cell.getchannel('A').tobytes()==resized.getchannel('A').tobytes()
            report.append({'source':src.name,'source_bytes':src.stat().st_size,'source_sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'export':dest.name,'cell':[w,h],'rgba_diff':0,'alpha_diff':0})
        report.append({'atlas':dest.name,'bytes':dest.stat().st_size,'dimensions':decoded.size,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()})
    for src in assets.glob('*icon*.png'):
        im=Image.open(src).convert('RGBA').resize((22*scale,24*scale),Image.Resampling.LANCZOS)
        dest=out/f'{src.stem}-{scale}x.webp'; im.save(dest,lossless=True,exact=True,method=6)
        assert Image.open(dest).convert('RGBA').tobytes()==im.tobytes()
        report.append({'icon':dest.name,'source_bytes':src.stat().st_size,'bytes':dest.stat().st_size,'dimensions':im.size,'rgba_diff':0,'alpha_diff':0})
(out/'exports.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
