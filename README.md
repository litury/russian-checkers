# russian-checkers

2D Russian draughts for [Yandex Games](https://yandex.com/games). Phaser 4 client. Slice 1 is a local game against a bot. No multiplayer server and no marketing site in this slice.

## Rules (Russian draughts)

- Capture is mandatory, including backward capture
- Flying kings
- Turkish strike (continue capturing with the same piece)

## Slice 1

In:

- Rules engine
- Greybox table, legal-move highlights, first click without a rules wall of text
- Game vs bot (legal moves only; captures if any exist; otherwise random legal)
- Yandex Game Ready without login; interstitial only after a match

Out: WebSocket rooms, hotseat, landing/Next, bot ladder, rating, skins, chat, tutorial.

## Run

Install JS dependencies, then use the package scripts:

- `dev` — Vite dev server. Locally the Yandex SDK script is missing, so Game Ready is stubbed and ads are skipped.
- `test` — Vitest
- `check` — Biome format and lint
- `build` — typecheck and write static `dist/` for a later Yandex ZIP

## License

MIT
