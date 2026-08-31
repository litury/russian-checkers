# russian-checkers

2D pixel Russian draughts for [Yandex Games](https://yandex.com/games). Phaser client. Slice 1 is a local game against a bot. No multiplayer server and no marketing site in this slice.

## Rules (Russian draughts)

- Capture is mandatory, including backward capture
- Flying kings
- Turkish strike (continue capturing with the same piece)

## Slice 1

In:

- Rules engine
- Pixel table, legal-move highlights, first click without a rules wall of text
- Game vs bot (legal moves only; captures if any exist; otherwise random legal)
- Yandex Game Ready without login; interstitial only after a match

Out: WebSocket rooms, hotseat, landing/Next, bot ladder, rating, skins, chat, tutorial.

## Status

Architecture lives in `docs/`. Next: scaffold client and rules, no engine in the architecture PR.

## License

MIT
