# Ресурсы игры

Готовые изображения и атласы находятся у владельцев: `client/features/menu/assets`,
`client/features/match/board`, `hud/assets`, `actions/assets` и `result/assets`
внутри модуля матча. Звуки — в `client/audio/assets`.
Игра не требует Python или генераторов ресурсов.

Сохранённые исходники и сведения об их происхождении:

- `assets/sources/audio` — записи о происхождении игровых звуков.
- `assets/sources/match-actions` — PNG-исходники кнопок и диалогов; WebP для игры остаются в `client/features/match/actions/assets`.
- `assets/sources/menu-panels` — одобренные исходники главного меню: каменный фон, заголовок, две кнопки и общая панель выбора стороны со счётом, без гнёзд под шашки. Содержит оригиналы генерации через `image_gen` в Codex CLI, задание и превью телефона/десктопа. Готовые WebP находятся в `client/features/menu/assets/menu-controls`: `background.webp` и общий `atlas.webp`. JSON рядом хранит nine-slice, состояния кнопок, хеши оригиналов и параметры очистки alpha. Текст и анимированные шашки накладываются отдельно. PNG-исходники и превью браузер не загружает.
- `assets/sources/font-sources.json` — сведения об источниках шрифтов, не включаемые в сборку.
- [Музыка](../music-loops/README.md) — описание двух поставляемых тем и их provenance.
- [Арт результата](../verdict-art-provenance/README.md) — оригиналы генерации и записи об их происхождении.
- `client/features/menu/assets/siege/provenance.json` — происхождение элементов меню; `source_aliases` указывает оставшиеся файлы вместо точных дублей.
- `client/fonts` — шрифты и исходные лицензии.

Старые абсолютные пути в provenance описывают историю получения материала,
а не текущие команды запуска. Записи в `assets/sources/audio` не входят в glob
игрового звука и не загружаются браузером.
