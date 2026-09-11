# Defeat screen release

Approved scope: both human-side checker animations, diagnostic terminal v2, accessible controls and transitions, mechanical button faces. No click sound is included.

## Runtime
- Human side is passed explicitly to the result overlay (current bot mode: white).
- Nine frames per color, 00 through 08, then final pose. Reduced motion shows 08 immediately.
- Terminal composition: terminal_sockets → primary rest/pressed → secondary rest/pressed, registered at (0,0), 324×432. Texture positions do not shift; labels move 3/2 logical pixels while pressed.
- Native modal controls retain focus trapping, keyboard-only focus corners, release/cancel and single activation. Entry/exit fades are 180/120 ms and do not delay actions.

## Verification and limits
The staged release tree was exported separately from the shared working directory and passed 95 tests in 17 files plus TypeScript/Vite production build. The local meadow-removal regression test is intentionally excluded with that unrelated work.

Earlier developer Playwright CLI runs covered desktop/mobile button presses, cancel, Tab/Shift+Tab, Enter/Space, replay, double click, early close and reduced motion. These runs used the shared working directory, not an isolated release browser build.
Independent QA reports covered natural timeout defeat, terminal mobile/landscape, both final poses via live-scene fixtures, touch replay, early close and victory smoke. Targeted feel QA used trusted CDP touch events and inspected the accessibility tree. The QA full coordinate-based feel scenario timed out before reaching defeat; it was not an independent full pass.

Still open: independent QA of final mechanical faces, physical phone testing, VoiceOver/TalkBack, exact browser frame timing, safe-area device testing and click-sound approval/license/mute verification. Accessibility-tree inspection does not replace a screen-reader run. No external CI or deployment success is claimed.

## Excluded local work
Meadow-decor removal and its regression test, unrelated HUD/title assets and documents, preview generations, screenshots, browser logs and the obsolete monolithic terminal source remain outside this release. Existing local work must not be discarded.
