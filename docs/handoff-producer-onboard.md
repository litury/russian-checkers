# Inbox продюсера — полный контекст (2026-09-04)

Ты @producer. Человек будет сидеть в ТВОЁМ Bot Chat. Этот файл — вся рабочая память студии. Прочитай и веди очередь. Не пиши @hermes (`message_agent` → default = `target_busy`).

## Люди и боты

| Кто | Роль |
|---|---|
| Человек (litury) | PO: вкус, 1:1 калибровка, апрув арта, «пушь» |
| @producer | inbox и нарезка. Не рисует, не кодит |
| @designer (Illustrator) | 2D pixel, PixelLab |
| @developer | Phaser, правила, localhost, git по команде |
| @qa | playtest, баги файлами |
| @hermes (default) | старый лид-чат; пайплайн больше не через него |

Группа Desktop: **Studio**. Репо: `/Users/urylit/russian-checkers` (GitHub `litury/russian-checkers`). Ветка `main`. Коммиты/пуши **только если человек сказал**.

## Как координировать (сломано и что вместо)

- DM в чей-то **Bot Chat**, пока человек там сидит → `target_busy`.
- CLI `hermes -p X chat -c "Bot Chat"` пока открыт 1:1 → `live owner` / Turn failed.
- Шина: `docs/handoff-<task>.md` + `docs/handoff-<task>.status.md` + артефакты на диске.
- Человек: «проверь» → ты читаешь диск.
- Видимый разговор команды: **Bots → Studio**, не лички.
- После kill CLI: если Desktop всё ещё «занят» — снять мёртвую строку `session_turn_leases` в `~/.hermes/profiles/<bot>/state.db`.

## Игра

- Phaser, WebSocket + hotseat, Yandex Games.
- Локально: `npm run dev` → http://localhost:5173/ (ранее pid 25433; если мёртв — @developer поднимает, без коммита).
- Общий браузер у ботов нет. Общий каталог — да.
- Онлайн уже в архитектуре. Архитектора БД / новые роли под «онлайн потом» не заводить.

## Открытая работа: lose-маскот

Бриф: `docs/handoff-lose-mascot.md`. Статус-файла **нет**. PNG **не перегенерированы**.

Пути: `src/client/app/ui/result/mascot_lose_00.png` … `_05.png`

Факт (код ок, битые кадры):
- 00 = копия idle
- 01–02 ок
- 03–04 магента #FF00FF
- 05 съехал влево; на нём холд анимации
- `startLose()` / `loseHolds` не трогать

DoD: тот же рыцарь, 6 кадров, оседание не взрыв, 128×128, без магенты, персонаж по центру, без коммита. Сдача: перезапись PNG + `docs/handoff-lose-mascot.status.md`. Человек проверяет «сдаться» на :5173.

PixelLab: токен только `PIXELAB_API_TOKEN` в `~/.hermes/profiles/designer/.env`. В чат/git/SOUL не писать. Платные генерации — апрув человека. Скилл дизайнера: `pixellab-sprites`. Gemini = мудборд.

Иллюстратор **не в процессе** (CLI нет). Не слать ему `message_agent`, пока человек может открыть 1:1 Illustrator — пиши/обновляй handoff-файл.

## Что уже на диске (не коммитить без спроса)

- `docs/studio-pipeline.md`
- `docs/handoff-lose-mascot.md`
- `docs/coord-ping.md` = `coord ok` (illustrator)
- `docs/coord-ping-developer.md` = `coord ok` (developer)
- ранее untracked: `package-lock.json`, `docs/review-*.md`

## Калибровка 1:1 (не пайплайн)

- С дизайнером обсуждали PixelLab vs Gemini, не шашки. OpenRouter ключ не подключали.
- 1:1 = вкус/SOUL. После удачного правила — в SOUL специалиста, не только в чат.

## Твоя ближайшая очередь

1. Принять inbox. Коротко человеку: «на связи, lose в работе».
2. Lose: убедиться что бриф актуален; исполнитель @designer через файл, не DM hermes.
3. Когда status.md + PNG на месте — сказать человеку проверить «сдаться».
4. Код слотов/таймингов не нужен, пока кадрам ок. Иначе handoff @developer.
5. QA — после новых кадров, не раньше.

Не раздувай скоуп. Не заводи BA/геймдизайнера/архитектора.
