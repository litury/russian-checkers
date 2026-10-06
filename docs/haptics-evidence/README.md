# Haptics candidate — t_bbf3afb2

Base: d0387443e09e07974773aaaebb83e38a3250ccaa
Branch: task/t_bbf3afb2-haptics

Author verification (not independent QA):
- Full Vitest: 127 files, 634 tests passed.
- TypeScript --noEmit and Vite production build passed.
- scripts/haptics-browser.mjs: 30 assertions in isolated headless Chrome, including two independent online clients on disposable local API/PostgreSQL. navigator.vibrate spy; real board input. Fixtures and test-only scene access are injected by the script, not shipped.
- scripts/haptics-production-browser.mjs: unchanged production bundle, keyboard selection and move produced [10,15]; no page errors.
- New haptics.ts/haptics.spec.ts pass Biome after formatting. Repository-wide Biome remains red; baseline and candidate summaries are retained (candidate summary predates final formatting). Existing touched files have pre-existing formatting/import issues; no global cleanup attempted.

Patterns: tick 10 ms; move 15 ms; capture 23 ms; promotion [12,45,12]. Promotion supersedes capture at the same landing. Setting defaults off and preserves checkers.menuVibration. Independent of sound. Disable/background cancels the active pattern.

Limitations:
- API calls verified, not physical vibration. User will check S25 after release.
- Safari/iOS generally lack Vibration API. Missing API, false return, denied permission and exceptions are nonfatal and do not change game state.
- Cross-origin catalog iframe (including Yandex Games) may restrict Vibration API. No permission bypass, native bridge or amplitude control. No guarantee of identical tactile feel across devices.
- Browser verification uses installed Playwright at /home/hermes/.hermes/team/studio/browser-tools/node_modules/playwright/index.mjs and /usr/local/bin/google-chrome. Local online script expects Vite 4230 and API 4229; production smoke expects preview 4231.
- npm ci replaced the repository's tracked node_modules symlink locally with dependencies; that environment-only deletion is excluded from the candidate commit. Do not commit node_modules.
- No push, production deployment or independent QA has occurred.

Sources:
https://developer.android.com/develop/ui/views/haptics/haptics-principles
https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate
