# t_dce9b5fa — авторский кандидат меню

База fetch origin/main: 7583bdefb08bbfec37b17bebfa3749c9e6ea787b.
Ветка task/t_dce9b5fa-play-menu; worktree /home/hermes/projects/russian-checkers/.worktrees/t_dce9b5fa.
Это самопроверка, не независимый QA и не публикация. Визуальное принятие владельцем запрошено через координатора, пока не подтверждено.

## Реализовано

Главное меню: центральная «Играть», ниже «Профиль» / «Настройки». Нажатие «Играть» заменяет действия в той же области на «С ботом», «Онлайн · N», «Назад». Отдельной сцены, нового modal, ассетов и сетевого запроса на переходе нет. Использованы существующие atlas plates без изменения размеров; текст отдельно.

HTML-first capture navigation работает до загрузки engine и сохраняется после установки runtime onclick. Первый клик не ставит pendingPlay. Нажатие режима запускает прежний поток. Двойной click не переходит из главного меню сразу к старту; pending start нельзя сбросить кнопкой Назад. Escape и возврат фокуса, скрытые действия исключены из Tab. После возврата из партии показывается главное меню.

Число — существующий liveTotal из presence, уже получаемый на главном меню; heartbeat/guest/WS/API/backend не изменены. Неизвестно — просто «Онлайн»; подтверждённый 0 сохраняется. Счёт физически внутри кнопки, фиксированные размеры. Это текущая табовая метрика online, не число ищущих и не уникальные люди.

## Проверено инструментами

- npm ci --ignore-scripts; npm --prefix server ci --ignore-scripts: exit 0, 0 vulnerabilities.
- node node_modules/typescript/bin/tsc --noEmit: exit 0.
- VITE_API_URL=http://127.0.0.1:8798 node node_modules/vite/bin/vite.js build: exit 0; log artifacts/play-menu/build.log.
- node node_modules/vitest/vitest.mjs run src/client/app/menuNavigation.spec.ts src/client/app/coldStartup.spec.ts src/client/app/opening*.spec.ts src/client/app/menu*.spec.ts src/client/app/siege*.spec.ts src/client/app/presenceOrdering.spec.ts src/client/app/onlineHub*.spec.ts src/online --maxWorkers=1 --reporter=json --outputFile=artifacts/play-menu/unit-expanded.json: 292/292 tests, exit 0.
- git diff --check: exit 0.
- Biome выбранных файлов: НЕ PASS; существующие форматирование/non-null в hotspot-файлах и стиль нового inline/test кода. Проверки не выключались; formatting sweep не выполнялся.

## Реальный браузер

Изолированный headless /usr/local/bin/google-chrome через общий Playwright, отдельные storage contexts, allowlist только 127.0.0.1:5198/8798; Browser Use/личный Chrome не использовались.

node scripts/play-menu.browser.cjs — phone390×844 и desktop1280×900, main→modes→back, PNG и короткое WebM, pageerrors[].
node scripts/play-menu-cold-warm.cjs — 390/1280×844, cold и warm reload, первый клик ещё до engine не ставит pending; Tab→Онлайн→Назад, Enter/возврат фокуса, double-click main не запускает игру. Ровно один resource entry существующего opening atlas до и после перехода. Это не общий network/performance benchmark.
node scripts/play-menu-regression.cjs — настоящий собственный API + disposable PostgreSQL, два контекста 390/1280. Online 1→2 ещё до клика; по три открытия hub с тем же count=2, queue=0, по одному существующему resume WS без добавления WS на переходах; profile/settings/Escape/focus. Ошибка presence убирает только число, геометрия кнопки не меняется; восстановление возвращает 2. У phone online hitbox177×70, desktop320×70; count bbox внутри обоих. API полностью недоступен: reduced-motion bot запускается double-click без ошибок, реальный a3-b4 и ответ бота (Undo enabled), resign→menu возвращает «Играть».

Повторные видеозаписываемые длинные regressions на загруженном общем сервере зависали по deadline; такие прогоны НЕ заявлены успешными. Для regression убрана необязательная запись видео, добавлен гарантированный browser cleanup; затем полный сценарий прошёл. Короткие preview WebM отдельно получены успешно. Один ранний repro-script падал на неоднозначном [data-verdict=menu] из-за скрытого второго verdict; исправлен selector :visible, продуктовый код не менялся по этому поводу.

## Стенд и воспроизведение

Preview http://127.0.0.1:5198/ (Vite preview --strictPort).
API http://127.0.0.1:8798/, /health реально ok:true/db:true/queue:0.
Собственный контейнер t_dce9b5fa-postgres, bind127.0.0.1:55497, disposable DB menu_probe, trust только внутри отдельного стенда. Не production DB. Процессы и данные других задач не трогать. Перед новым exact-count прогоном после закрытых браузеров дать старой presence истечь (TTL18s).

Запуск после установки зависимостей:

    DATABASE_URL=postgres://menu_probe@127.0.0.1:55497/menu_probe PORT=8798 HOST=127.0.0.1 node node_modules/vite-node/dist/cli.mjs --config server/vite.config.ts server/src/index.ts
    VITE_API_URL=http://127.0.0.1:8798 node node_modules/vite/bin/vite.js build
    node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5198 --strictPort

## Координация и границы

hotspot: index.html — t_6164a667 illustrator изменяет ТОЛЬКО внутренний settings dialog/layout/controls. Мой diff ограничен opening-actions, setCta и отдельными opening-mode-navigation blocks. #opening-settings-dialog и его CSS/controls не менялись. Срезы согласованы комментарием в t_6164a667; сохранить opening-utility-label входной кнопки.
hotspot: src/client/app/openingOverlay.ts — сохранены уже интегрированные profile/options/presence/result.

Новый online match/reconnect не выполнялся: сетевые authority/queue/cancel/reconnect реализации не менялись, real two-context проверка покрывает presence и вход в hub без автоочереди. Физический телефон, физическое прослушивание звука, deploy и live readback не выполнялись. Настройки/haptics/цвет не переписаны. Полный suite всей игры не заявлен. QA должен независимо проверить изменённый путь и интеграцию свежего main; публиковать только после визуального принятия владельцем и QA PASS.
