# t_0ffb3d13 — авторский кандидат online hub / presence

База: bfde71d80b314c4c4fa9dd6c5fb19be944adb87c (fetch origin/main). Ветка: task/t_0ffb3d13-online-readiness. Авторская проверка, НЕ независимый QA и НЕ публикация.

## Причина и исправление

Production damka.fun воспроизведён отдельным headless Chrome for Testing с новыми storage contexts 390×844 и 1280×844; личный Chrome/Browser Use не использовались. Chrome trace filmstrip до изменения показывает сначала тёмную панель с голыми надписями (390: кадры 9–10), затем кнопки/рамку (кадр 11). CSS-изображения скрытого dialog запрашиваются только при showModal; showModal не ждёт скачивания/decode. Это не доказательство необходимости атласа.

onlineHubArt.ts прогревает шесть существующих поверхностей после 500 ms и idle callback, не в критическом HTML-first кадре. Открытие ждёт общий Promise decode и кириллических Literata/Golos. Deadline изображений 3 s, шрифтов 1 s. Ошибка не оставляет меню скрытым: открывается функциональная текстовая fallback-панель; следующее открытие повторяет подготовку. Отменённое/закрытое меню не открывается поздним callback. Арт не перерисован и не перекодирован, layout прежний, атлас не добавлен.

Presence запрашивается автоматически при создании основного opening overlay, до клика, то есть после существующего отложенного engine bootstrap, не в первом HTML-first кадре. Число рядом с «В сети» и заголовок hub читают один liveTotal. Нет sample/нулевого placeholder: неизвестно — «—», подтверждённый 0 — реальный 0. Убран параллельный GET interval 2 s; один последовательный heartbeat loop 8 s, GET только fallback к неудачному beat. Visibility/pagehide останавливают loop и abort текущего presence request, pageshow/return возобновляют. Shutdown удаляет listeners, timer, badge, отменяет idle warmup. Запрос не включает очередь/комнату.

Дополнительно runtime выявил гонку ensureGuest: одновременно stats/resume/presence могли создавать разные identities в одном браузере, а следующий beat менял identity, временно завышая count до TTL. В cloud.ts добавлен single-flight guest request. Неверные live:null/string/negative/fraction не преобразуются в фиктивный ноль.

## Семантика API

GET/POST /stats/presence — глобальный siteLive(), не длина matchmaking queue. Ключ текущего сервера `${playerId}:${tab}`, TTL 18 s: это существующий показатель активных видимых browser-сессий/вкладок, НЕ гарантированно уникальные люди. Семантика не изменена; интерфейс не подписан «уникальные игроки». При закрытии контекста без доставки pagehide запись может оставаться до TTL; повторный изолированный прогон должен дождаться 19 s либо использовать новый свой API-процесс. Backend/schema не изменялись.

## Измерения

Полные ресурсы/bytes, RAF rectangles/fonts и Chrome Decode/Layout/Paint events: online-trace-before/after/timeline.json и *.json.gz. filmstrip.png получен из реальных Trace Screenshot events, не синтетические кадры. Снимки before/first/ready сохранены отдельно.

Первый RAF с открытым dialog от программного DOM click (не скорость всей загрузки приложения):

| viewport | prod cold (ещё неполный) | candidate cold (подготовлен) | prod warm | candidate warm |
|---|---:|---:|---:|---:|
| 390×844 | 12.3 ms | 235.9 ms | 8.3 ms | 9.4 ms |
| 1280×844 | 24.1 ms | 459.4 ms | 16.8 ms | 9.4 ms |

В prod изображения рамки/кнопок заканчивают HTTP уже ПОСЛЕ первого открытого RAF: 45.1/64.3 ms. В кандидате — до первого открытого RAF: 24.3/63.8 ms; открытие дополнительно ждёт decode/fonts. Кандидат не выдаёт ранний частичный кадр за готовность. Filmstrip candidate: первый видимый hub уже с рамкой/фоном/кнопками/надписями.

Ресурсы hub после click: prod cold 468348 transfer bytes, candidate cold 495184 bytes (добавлен прогрев pressed-state); warm 0 в обеих версиях. Полный набор 6 существующих WebP: 577634 file bytes, включая общий slate, который может быть уже загружен до click. Размеры изображений не уменьшались. Это исправление атомарного показа, НЕ доказанный выигрыш startup/общей скорости. Prod и localhost имеют разный network path; машина разделяется с коллегами, поэтому приведённые одиночные прогоны нельзя трактовать как строгий CPU benchmark. Decode-события включают другие загрузки за доской, не только hub.

## Реальные проверки

- tsc --noEmit: exit 0.
- vite build с VITE_API_URL=http://127.0.0.1:8793: exit 0.
- vitest run src/online src/client/app/onlineHub.spec.ts src/client/app/onlineHubArt.spec.ts src/client/app/siegeGateTransition.spec.ts src/client/app/opening.spec.ts src/client/app/onlineAvailability.spec.ts --maxWorkers=1: 18 файлов, 96 тестов PASS.
- Реальные API + disposable PostgreSQL: два независимых browser contexts. До клика count 1 → 2; три открытия/возврата каждого hub; одинаковое число в menu/hub; скрытие второго → 1, возврат → 2; скрытый клиент 8.5 s без новых beats; abort presence routes → «—» при работающей кнопке; снятие abort → 2. Нет pageerror. Каждый клиент имеет один существующий resume WS; открытия hub не добавляют WS. Это проверка presence/hub, не новая онлайн-партия.
- Блокировка frame WebP: fallback открыт, «Найти» доступно; после снятия блокировки повторное открытие data-art=ready. online-runtime/art-result.json.
- Реальные pointer clicks используются в presence и art-failure scripts; performance probe использует DOM click ради точной временной точки.
- git diff --check: exit 0.
- Biome check выбранных файлов НЕ PASS: форматирование/organizeImports, non-null assertions в существующих файлах. Новый onlineHubArt отформатирован отдельно; общей форматирующей переработки hotspot-файлов нет. Проверки не отключались.

## Воспроизведение QA

Workspace: /home/hermes/projects/russian-checkers/.worktrees/t_0ffb3d13
Preview: http://127.0.0.1:5193
API: http://127.0.0.1:8793 (health ok:true/db:true); PostgreSQL только задачи: контейнер t_0ffb3d13-postgres, bind 127.0.0.1:55493, DB online_probe. Не использовать общий production DB.

Команды из собственного worktree:

    npm ci --ignore-scripts
    npm --prefix server ci --ignore-scripts
    node node_modules/typescript/bin/tsc --noEmit
    VITE_API_URL=http://127.0.0.1:<свой API> node node_modules/vite/bin/vite.js build
    node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port <свой preview> --strictPort

Browser scripts используют общий проверенный playwright package и /usr/local/bin/google-chrome. online-frame-trace.cjs принимает target URL и output directory; presence/art-failure scripts сейчас фиксируют авторские 5193/8793, для QA заменить только локальные порты в своей копии. Перед presence script после других браузеров выдержать TTL; healthy isolated API нужен с нулевым исходным count. Никаких токенов/credentials в отчёте или архиве нет.

## Координация и ограничения

hotspot: src/client/app/openingOverlay.ts — согласован только presence/menu badge/warmup/lifecycle. t_c4eaa6b1 сохраняет bindMatchHistory/profile; t_ab348dc7/t_b80b9bfc — result/resign; t_efc14a88 — options. index.html, gameScene.ts, result/resign/history/options не изменены. Последовательная интеграция со свежим main — только после независимого QA.

Не проверялись физический телефон, новый матч/reconnect gameplay и полный suite всей игры (сеть authority не менялась). Count следует действующему API с табовой семантикой. Запрос начинается после engine-created menu, а не до существующей двухсекундной отсрочки engine; bootstrap не расширялся в рамках узкой правки.

Время: карточка запущена 2026-10-15 13:37:32 UTC; diagnosis/implementation выполнялись вперемежку, точный раздельный таймер не велся. Первый целевой прогон 13:41, регресс+browser rework до ~14:03 UTC. Независимый QA/ожидание/интеграция/деплой автором не выполнялись; их время нельзя включать в реализацию.
