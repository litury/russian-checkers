#!/usr/bin/env python3
"""Embed menu-character subsets as offline src fallbacks with identical metrics.
Requires fonttools + brotli. Original fonts/licences are untouched.
"""
import base64
import io
import re
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont
ROOT = Path(__file__).resolve().parents[1]
p = ROOT / 'index.html'
html = p.read_text()
for name in ('Literata-600-cyrillic', 'GolosText-400-cyrillic', 'GolosText-600-cyrillic'):
    path = ROOT / 'src/client/fonts' / (name + '.woff2')
    original = TTFont(path)
    font = TTFont(path)
    options = subset.Options()
    options.flavor = 'woff2'
    worker = subset.Subsetter(options=options)
    # All existing ASCII/Cyrillic glyphs plus menu punctuation, not a new font.
    chars = [cp for cp in original.getBestCmap() if cp < 0x500 or 0x2000 <= cp <= 0x206F or cp == 0x2116]
    worker.populate(unicodes=chars)
    worker.subset(font)
    for cp in chars:
        assert font['hmtx'][font.getBestCmap()[cp]] == original['hmtx'][original.getBestCmap()[cp]]
    for attr in ('ascent', 'descent', 'lineGap'):
        assert getattr(font['hhea'], attr) == getattr(original['hhea'], attr)
    stream = io.BytesIO()
    font.save(stream)
    encoded = base64.b64encode(stream.getvalue()).decode()
    primary = f"url('/src/client/fonts/{name}.woff2') format('woff2')"
    # Offline-first prevents font-display:optional from abandoning a later src
    # after the network timeout. No readiness gate or separate font request.
    replacement = f"url('data:font/woff2;base64,{encoded}') format('woff2')," + primary
    data = r"url\('data:font/woff2;base64,[^']+'\) format\('woff2'\)"
    pattern = r"(?:" + data + r",)?" + re.escape(primary) + r"(?:," + data + r")?"
    html, count = re.subn(pattern, lambda _: replacement, html)
    assert count == 1, (name, count)
    print(name, len(stream.getvalue()), 'bytes; exact hmtx/hhea subset fallback')
p.write_text(html)
