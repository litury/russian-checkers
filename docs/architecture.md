# Архитектура

Клиент — Phaser 4, TypeScript и Vite. Сервер — Node.js, TypeScript, HTTP/WebSocket
и PostgreSQL. Смена стека на Vue или C# в проект не входит.

## Части приложения

- `client/app/main.ts` запускает Phaser. Интерфейс, ввод и отрисовка находятся в клиенте.
- `client/features` содержит владельцев меню, матча, профиля и настроек.
- `client/features/match/board` и `bot` владеют доской и выбором хода бота.
- `shared/rules` содержит чистые правила игры, позиции, ходы, победы, ничьи и расчёты часов.
- `client/platform/network` содержит HTTP/WebSocket-клиент и адрес API.
- `client/audio` владеет воспроизведением и игровыми звуковыми сигналами.
- `shared/protocol` содержит общие модели матча, записи ходов и воспроизведение партии.
- `server/src/index.ts` запускает API, WebSocket и взаимодействие с PostgreSQL.
- `server/sql/migrations` — единственный источник схемы; первую миграцию использует также Docker bootstrap.

Правила не должны зависеть от DOM, Phaser, HTTP и базы данных. Клиент и сервер
используют один движок. API проверяет ходы и управляет онлайн-комнатами и часами.

## Где менять игру

| Задача | Код |
| --- | --- |
| Запуск и HTML-меню | `index.html`, `client/features/menu/siegeOpeningBootstrap.ts` |
| Композиция Phaser и представлений | `client/features/match/gameScene.ts` |
| Состояние, история и отмена | `client/features/match/matchSession.ts` |
| Выбор фигуры, ход, анимация и ответ бота | `client/features/match/matchInteraction.ts` |
| Обязательная/необязательная загрузка | `client/features/match/matchResources.ts` |
| Поиск, реконнект и входящие ходы | `client/features/match/online/onlineMatchCoordinator.ts` |
| Правила хода, взятия, дамки и завершения | `shared/rules` |
| Отрисовка доски и шашек | `client/features/match/board` |
| Выбор хода бота | `client/features/match/bot/pickBotMove.ts` |
| Геометрия доски и панелей | `client/features/match/hud/matchLayout.ts`, `client/features/match/hud/playerPanelLayout.ts` |
| Панели и часы | `client/features/match/hud/createHud.ts`, `client/features/match/matchClock.ts` |
| Кнопки отмены и сдачи | `client/features/match/actions/matchActions.css`, `client/features/match/actions/assets` |
| Графика главного меню | `client/features/menu/assets/opening-atlas`, `client/features/menu/assets/siege` |
| Игровые звуки | `client/audio/menuAudio.ts`, `client/audio/assets` |
| Подключение к онлайн-партии | `client/platform/network/live.ts`, `client/platform/network/cloud.ts` |
| Запуск API | `server/src/index.ts` |
| Комнаты и обработка ходов | `server/src/matches/service.ts`, `server/src/matches/repository.ts` |
| HTTP/WS-транспорт | `server/src/transport` |
| Авторизация, игроки, статистика, присутствие | `server/src/auth`, `players`, `stats`, `presence` |
| Схема базы данных | `server/sql/migrations` |

Ввод на доске попадает в сцену; доступные ходы определяются общими правилами.
В партии с ботом ответ выбирается в браузере. В онлайн-партии ход передаётся
серверу, проверяется и рассылается участникам через WebSocket.

## Границы модулей

Клиент и сервер могут импортировать `shared`, но общий код не импортирует клиент
или сервер. Браузерная сеть принадлежит `client/platform/network`; SQL и управление комнатами —
серверу. Алиас `@/` указывает на корень проекта и одинаково работает в обеих сборках.

## Состояние и жизненный цикл

`MatchSession` хранит позицию, историю, отмену и результат. Переходы между
`title`, `human`, `bot`, `over` перечислены явно. Пауза, анимация и соединение —
независимые состояния, а не дополнительные взаимозаменяемые фазы.

`MatchClock` считает оставшееся время по переданному timestamp; в онлайне
принимает серверные часы. `BotTurn` отменяет устаревшие отложенные ответы.
При shutdown снимаются DOM/SDK-подписки, отменяются боты, прогрев и live-сессия.

HTML-меню, настройки и запуск вынесены из inline JS в лёгкие TypeScript-модули.
Они не импортируют Phaser как runtime-зависимость. Сцена остаётся владельцем
Phaser lifecycle и сборки представлений, а не сетевого транспорта или SQL.

Сервер создаёт сервисы с явными зависимостями; комнаты и очередь принадлежат
экземпляру matches, а не глобальным картам при импорте. Схема БД и протокол сохранены.

## Ресурсы и поставка

Игра использует готовые атласы, изображения, шрифты и звук рядом с клиентским кодом.
Исходники кнопок и сведения о происхождении звука и шрифтов находятся
в `assets/sources`, вне glob загрузки. Старое оформление результата и неиспользуемый
аудиоархив удалены. Исходные лицензии шрифтов остаются в `client/fonts`,
но отдельные публичные копии больше не включаются в сборку.

`nginx.conf` отвечает только за раздачу готового клиента в Docker: сжатие,
кеширование ресурсов и возврат входной страницы. Для `npm run dev` он не нужен.

`npm run verify` проверяет типы клиента/API и создаёт статический `dist`.
GitHub Pages CI выполняет эту команду;
автоматического тестового набора сейчас нет. API развёртывается отдельно от клиента.
