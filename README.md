# russian-checkers

2D pixel Russian draughts for [Yandex Games](https://yandex.com/games). Phaser client. Live matches over a small WebSocket server. If the server is down, two players share one screen.

This repo is the first Yandex Games title of the studio. Game design for slice 1 lives with the designer; architecture goes in `docs/` after the architect cuts boundaries.

## Rules (Russian draughts)

- Capture is mandatory, including backward capture
- Flying kings
- Turkish strike (continue capturing with the same piece)

## Slice 1

In:

- Rules engine
- Pixel table, legal-move highlights, first click without a rules wall of text
- Two-player room: turn, reconnect, opponent is a person
- Hotseat fallback when WSS is down
- Yandex Game Ready without login; interstitial only after a match

Out: bot ladder, rating, skins, chat, tutorial.

## Status

Empty on purpose. Next: architecture in-repo, then build.

## License

MIT
