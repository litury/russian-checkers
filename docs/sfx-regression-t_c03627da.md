# t_c03627da — capture/promotion SFX regression candidate

## Scope / cause

Fresh base: 8116e1422c0c61066474b7e491286fd7aaacfdf8. Author worktree: /home/hermes/projects/russian-checkers/.worktrees/t_c03627da; branch task/t_c03627da-sfx-regression.

Reproduced a concrete promotion loss: KingFire.ignite checked optional ignite sheets before emitting the functional cue. Missing/late sheets queued visual recovery with audible=false, so the promotion had neither immediate nor later audio. Fixed by emitting once at accepted ignition, before optional VFX/reduced-motion branches. Recovery remains silent: no stale or double cue.

Capture wiring was NOT permanently broken on this base: every landed victim emits crush-b in normal and reduced motion. Both colours have two actual capture starts in a two-hop chain. No blanket claim that the entire owner's inaudibility report is resolved: the accepted files are quiet, especially ignition; perceptual balance still needs independent listening. Producer t_d1f165ff owns subsequent balance, based on updated main; no concurrent gains edits in this candidate.

Critical capture/promotion buffers are now requested first on native activation, with high fetch priority rather than low-priority competition with dozens of voices. No gesture-free network warming, input await, deadline timer, delayed replay or settings changes. Warm/cold policy is unchanged: an event whose buffer is unavailable is dropped, and decode completion is not a playback event.

No changes to WAVs, voices, music, art, rules, global master or gains. hotspot: src/client/app/menuAudio.ts and src/client/modules/board/kingFire.ts.

## Author verification, not independent acceptance

- 136/136 tests across 7 targeted files; see artifacts/sfx-unit.log. Includes eight new tests: priority/de-duplication, cold drops/next event for both motion modes, mute/hidden/platform/effects/master. Existing promotion recovery assertion strengthened to demand immediate cue plus no recovery duplicate.
- TypeScript noEmit passed. Production build passed, with VITE_API_URL=https://api.damka.fun. Existing Vite configLoader extension warning remains.
- Native Chrome for Testing 154, headless disposable contexts, document-user-activation-required. No Browser Use or personal Chrome. Forced positions are set via existing DEV-only __checkersScene; selection and destination are native page.mouse.click on real board cells, not calls to cue functions. Bot reply suppressed only in harness to keep measured cues attributable.
- Baseline 16 cases: 22 functional starts. Missing optional ignition sheets -> zero promotion starts for both colours in normal motion; reduced and warm promotion start once. Captures start twice for both colours/motion modes.
- Candidate 16 cases: 24 functional starts. Every two-hop capture emits exactly two; every first promotion emits exactly one, even when both king-fire and king-fire-polish request paths are intentionally blocked. Assertions verify cold fireReady=false, final position and zero pageerrors.
- Separate held audio-fetch matrix 16 cases: moves complete with zero capture/ignite starts; release and decode produces zero stale starts. Native successful cases plus unit next-event tests distinguish a cold miss from permanent absence.
- Actual post-gain source PCM measured with AudioWorklet on render thread; this avoids missed attacks in sparse requestAnimationFrame analyser samples on software-rendered VPS. Each source's tap is independent of victim cries and other sounds; its output is silent and does not duplicate game audio. All successful functional sources: running context, effective gain ~.26, rendered peak .09214416. Peak 128-frame RMS: capture .06056102, ignition .05475961. These are short-block maxima, NOT full-duration RMS or LUFS, and NOT physical listening.
- Biome targeted check is red on baseline and candidate: same diagnostic multiset by path/category/severity/description (17 errors, 10 warnings), no new diagnostic. No formatter-wide edits or rule suppression. git diff --check passed.

Raw matrices: artifacts/sfx-baseline-matrix.json, sfx-after.json, sfx-cold-miss.json. Compact comparison: artifacts/sfx-matrix-summary.json. Reproduce with scripts/sfx-regression-matrix.cjs; SFX_URL sets dev server origin, SFX_BASELINE=1 selects expected old behaviour, SFX_COLD_MISS=1 holds actual audio requests, SFX_OUTPUT chooses output. Ports used: baseline 5308, candidate dev 5307, production preview 5309, all bound 127.0.0.1. Baseline is a clean git archive of exact base in .baseline, not a changed team checkout.

## Live readback (BEFORE publication)

scripts/sfx-live-readback.py retrieved exact live index/main and WAVs, not a guessed deployment. With production VITE_API_URL=https://api.damka.fun, clean baseline production build has BOTH exact matching bundle SHA-256 hashes (artifacts/sfx-baseline-exact-bundles.json):

- index-ByVoGL0W.js: 4ff98e551507ec24041b45ba2a8a7626f862aaf540bee6daea1bd48f494b4e89
- main-C5SKtbiz.js: 327832f191b118515421201b58da7972ccac46839161afdffc8dc6307e29af0e
- crush-b-B6cVnrXI.wav: bb519a01c4db04199bc38c73996aa2b49258a6f0fb06d028a219046f7a3ff748
- ignite-a-Ctoj-eGF.wav: cdb96af4c62008c2f0fbc039ecd3e9605a7b99078d4b5a1c8abd7634bdabdc08

WAVs equal accepted repo files byte for byte. Capture duration .2954875 s, raw RMS -26.89838 dBFS; ignition .4902268 s, raw RMS -30.60826 dBFS; default gain .26 means full-duration RMS -38.59891 / -42.30879 dBFS. Both have decoded nonzero attack/energy. Earliest absolute |sample|>.001: .136 ms / 0 ms; this is not 10%-peak perceptual attack (producer measured that separately).

Separate real live smoke and local production preview: native Play -> interactive bot board, zero pageerrors; screenshots and artifacts/sfx-production-smoke.json. External API/WS deliberately blocked, so these are not online tests. No live forced position seam: capture/promotion matrices above are explicitly local DEV execution of the checked source, not fabricated production gameplay evidence. No deploy performed by author.

## QA / release handoff

Review candidate with reviewer qa. Independent device listening/balance is not replaced by source starts or PCM measurements. Confirm accepted promotion regardless of optional VFX; no duplicate after sheet recovery; mute, cold drop and next ready event; capture chain both colours. On QA PASS, publish exact checked slice sequentially to main and perform damka.fun exact new bundle/asset readback immediately without another user approval. Producer balance follows this release from refreshed main.
