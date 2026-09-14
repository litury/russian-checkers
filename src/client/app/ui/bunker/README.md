# Approved bunker V2 runtime layers

These native RGBA PNGs are copied byte-for-byte from the approved `docs/preview-panel-bunker-v2/manifest.json` assets, excluding all `preview_only` text overlays; `steam-sheet.png` is the approved 6×3 atlas (72×56 cells).

Runtime preloading uses this source directory only. No docs path, sample text image or MP4 is loaded by gameplay. Names, clocks and status are Phaser Text in the existing bundled Golos Text 600 font. The rectangular opening mask [10,10,364,118) is applied using source crops supported by Phaser 4 WebGL, not Canvas-only GeometryMask. `opening-mask.png` is retained as the native reference but not preloaded.

Artwork/master provenance and existing source/font licenses remain in the preserved V2 source directory and `src/client/fonts/`. The local integration evidence is `docs/preview-bunker-integrated/`; the original V1/V2 videos and masters are unchanged.
