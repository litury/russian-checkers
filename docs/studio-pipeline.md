# Studio pipeline (шашки)

Шина — **файлы в репо**, не DM в Bot Chat.

Пока открыт чат с @hermes, боты не могут ему написать (`target_busy`). 1:1 в Bots во время пайплайна не открывать — CLI заберёт тот же Bot Chat.

## Поток

Inbox человека: **@producer** (Bots → Producer), не @hermes.

1. @producer пишет бриф в `docs/handoff-*.md`.
2. Исполнитель кладёт артефакт + `docs/handoff-*.status.md`.
3. Ты продюсеру: «проверь». Он читает диск.
4. Интеграция → @developer (код, localhost).
5. Пуш — только по твоей команде. @hermes в цепочке не участвует (`target_busy`).

## Lose сейчас

Бриф: `docs/handoff-lose-mascot.md`  
Статус: `docs/handoff-lose-mascot.status.md` (ещё нет)
