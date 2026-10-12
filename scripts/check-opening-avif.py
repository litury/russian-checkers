#!/usr/bin/env python3
"""Reproduce the pixel-exact AVIF alternative. WebP is preferred (smaller).
Example for the locally unpacked tools (no system installation):
 uv run --with pillow python3 scripts/check-opening-avif.py \
   --encoder ../codec/local/usr/bin/avifenc \
   --library-path ../codec/local/usr/lib/x86_64-linux-gnu
"""
import argparse
import os
from pathlib import Path
import subprocess
import tempfile
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'src/client/app/ui/opening-atlas'
p = argparse.ArgumentParser()
p.add_argument('--encoder', required=True)
p.add_argument('--library-path')
args = p.parse_args()
im = Image.open(OUT / 'atlas.webp').convert('RGBA')
env = os.environ.copy()
if args.library_path:
    env['LD_LIBRARY_PATH'] = str(Path(args.library_path).resolve())
with tempfile.TemporaryDirectory(prefix='avif-reproduce-', dir=ROOT.parent) as directory:
    png = Path(directory) / 'atlas.png'
    candidate = Path(directory) / 'atlas.avif'
    im.save(png)
    command = [str(Path(args.encoder).resolve()), '--lossless', '--speed', '8', '--jobs', '2', '--yuv', '444', '--cicp', '1/13/0', str(png), str(candidate)]
    subprocess.run(command, env=env, check=True)
    decoded = Image.open(candidate).convert('RGBA')
    assert decoded.size == im.size and decoded.tobytes() == im.tobytes(), 'Reject non-exact AVIF'
    (OUT / 'atlas.avif').write_bytes(candidate.read_bytes())
print(f'AVIF exact RGBA: {(OUT / "atlas.avif").stat().st_size} bytes; WebP preferred.')
