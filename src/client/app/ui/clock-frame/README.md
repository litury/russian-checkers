# clock-frame

Bunker clock frame states (`frame-c`, `frame-c-active`, `frame-c-lights`),
cropped at runtime from the approved bunker sheet by `bunkerPanel.ts`.

## Runtime WebP

Pillow 12.3.0 libwebp (quality 95 / lossless, method 4-6, alpha_quality 100). The PNGs stay as masters; the browser only requests the WebP twins:
- `frame-c.webp` — 13650 → 10080 B (x1.35, lossless)
- `frame-c-active.webp` — 13718 → 10182 B (x1.35, lossless)
- `frame-c-lights.webp` — 4338 → 3716 B (x1.17, lossless)
