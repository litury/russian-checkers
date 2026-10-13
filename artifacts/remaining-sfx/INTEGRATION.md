# t_27be8a2b — author candidate

Base origin/main: 6f2a9af3aa027cd1e51049b8c881010462948f27 (fetch verified this run).
Owner explicitly authorized integration, not a claim of physical listening.

12 active cue replacements: 10 prepared Stability outputs, ui_click reuses ui-tap, play-b reuses ui-open. 11 accepted cue names remain byte-identical. All 42 classified voice/music files remain byte-identical, including ah/ah-elf. No new paid requests this run. Original replaced delivery files are preserved in legacy-masters; generated masters, QC and original review retained.

integration-manifest.json maps 23 active nonvoice names, exact old/new SHA256, runtime paths and baseline call sites. Two paid outputs, result-ascension/result-disposal, are inactive/prepared: GameScene uses boardVerdict, not the old ceremony proxy. They cost 16 of the 96 credits already spent and are unused; masters/provenance remain preserved. Their replacement files still exist but are NOT counted as active playback. Original review archive is historical and its 25-active claim was incorrect. Runtime logic, rules, artwork and transport are unchanged. Same cue names mean existing gain hierarchy, caps, scene callbacks, stale suppression and voice ownership remain in force. Files changed from OGG to WAV have no duplicate stem. Unused legacy audio remains preserved, not claimed as replaced.

Timer slide is a short natural one-shot at existing first-visible-lift event. It is NOT stretched or artificially looped; existing phase envelope stops it at seating when necessary. Lock remains independently tied to seating. Source duration is 0.798 s; this does not promise continuous sound throughout the entire reveal. Gate/panel sources retain existing phase envelope and stopping callbacks. Playback onset evidence is technical source.start, not acoustic device latency.

Executed:
- focused Vitest: 104 tests passed, 7 files (one requested spec path did not exist and was not counted).
- full Vitest: 750 tests passed, 145 files.
- tsc --noEmit + production Vite build passed.
- npm run check failed: 533 errors, 237 warnings, 46 infos across repository. No automatic broad cleanup.
- separate native headless Chrome, temporary contexts, autoplay activation required, localhost-only network: normal and reduced Play, Options/Escape, c3-d4 and bot response; no pageerrors. Actual decode/start/stop timelines saved. Source 0.104126984 s turn-handoff observed after moves in both modes; reduced skips gate/timer mechanical sources. Screenshot validates board state, not hearing.

Harness first attempted waiting on visible Undo; timeout despite rendered playable board (HUD buttons absent in those runs). Failed logs retained. Final harness records gameplay with optional Undo/resign only when the existing HUD buttons are visible; NOT claiming Undo/result acceptance from that optional branch. No production logic changed to accommodate harness. timer-lock source can be absent when a frame skips its window; no catch-up is expected by existing policy.

Not exercised this author run: two-client online, held-fetch cold/late tests, SDK/hidden combination, outcome fixtures, fire-king fixtures, repeated screens, physical listening/device/Safari. Existing unit tests cover policies and binding, not those native scenarios. QA must test these acceptance boundaries on exact candidate before publication. No push/deploy by author.

Preview during this run: http://127.0.0.1:5293 (dev server, localhost only). Original sound review archive: sfx-owner-review.zip. Browser script: scripts/remaining_sfx_browser.cjs.
