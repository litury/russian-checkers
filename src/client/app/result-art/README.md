# result-art

Runtime layers of the result ceremony (чертёж/лик/поверхности), cut from the
approved preview sheet by `crop` and verified by `sha256` in `manifest.json`.

## Runtime WebP

Pillow 12.3.0 libwebp (quality 95 / lossless, method 4-6, alpha_quality 100).

The PNGs above stay as masters; the browser only requests the WebP twins:
- `lid.webp` — 848470 → 234788 B (x3.61, lossy q95, PSNR 36.71 dB)
- `lip.webp` — 231216 → 48336 B (x4.78, lossy q95, PSNR 37.53 dB)
- `rear.webp` — 195216 → 36436 B (x5.36, lossy q95, PSNR 38.8 dB)
- `pedestal.webp` — 328478 → 72340 B (x4.54, lossy q95, PSNR 37.75 dB)
- `mantle-0.webp` — 276337 → 72962 B (x3.79, lossy q95, PSNR 36.64 dB)
- `mantle-1.webp` — 305475 → 79800 B (x3.83, lossy q95, PSNR 36.93 dB)
- `mantle-2.webp` — 302127 → 77528 B (x3.9, lossy q95, PSNR 37.03 dB)
- `grip-left.webp` — 63426 → 15320 B (x4.14, lossy q95, PSNR 38.28 dB)
- `grip-right.webp` — 63865 → 15758 B (x4.05, lossy q95, PSNR 38.38 dB)

Set total: 2614610 → 653268 B.
