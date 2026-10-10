# Замеры старта: один инструмент локально и в CI

Статус этапа 1: скрипты работают локально в изолированном headless Chrome. CI-run пока НЕ выполнен: GitHub credential не имеет права workflow. Шаблон workflow хранится отдельно от дерева репозитория до выдачи права. pages.yml не меняется. Этап 2 (URL damka.fun, ночное расписание, журнал тренда) ещё не реализован и не считается проверенным.

## Принцип выпуска

Правка runtime в task-ветке → фиксированная серия на этой ветке → независимый QA → main. Публикация измерительного workflow — отдельный инфраструктурный bootstrap: workflow_dispatch впервые должен стать доступен на default branch. Это не разрешает публиковать неизмеренную runtime-правку. Первый bootstrap тоже требует независимой проверки.

## Один инструмент

scripts/startup-paired.mjs перенесён из paired.mjs карточки t_a1ec1c79. Сохранены реальный click #opening-play, PerformanceObserver LCP/longtask, метки damka, ResourceTiming и чередование AB/BA. Добавлены параметры, DPR3, warm/cold, CPU throttling, hashes dist, CDP wire accounting и контроль полноты. scripts/startup-summary.mjs строит одностороннюю Student t верхнюю 95% границу paired delta. Исходный критерий не изменён: upper95 <= max(100ms, 5% baseline mean). При 5 парах df4 t=2.131846786; отдельно проверено тестом. Это non-regression gate, а не абсолютный бюджет старта и не доказательство отсутствия причинной регрессии.

Зависимость браузера: playwright@1.64.0-alpha-1789764292000 (точная версия исходного инструмента, наличие в npm проверено). Импорт задаётся PLAYWRIGHT_MODULE: абсолютный путь к index.mjs; без него используется установленный пакет playwright. CHROME_PATH необязателен: в CI используется bundled Chromium, локально VPS /usr/local/bin/google-chrome. Только для доверенного локального dist VPS-режим добавляет --no-sandbox. Это разные browser builds; версии пишутся в browser.json, числа между средами напрямую не смешиваются.

## Локальный запуск

Собрать два неизменяемых dist с одинаковым VITE_API_URL=http://127.0.0.1:59999; npm ci и npm run build в изолированных worktree. Не использовать общий preview5173. Скрипт сам поднимает gzip HTTP server127.0.0.1:4319 и закрывает его. Порт должен быть свободен. Никакой production API: HTTP/CDP allowlist допускает только этот локальный origin, WebSocket блокируется. Fetch interception вместо context.route сохраняет возможность HTTP cache; фактические cache signals и transferSize доступны в raw.

    PLAYWRIGHT_MODULE=/absolute/path/playwright/index.mjs CHROME_PATH=/usr/local/bin/google-chrome node scripts/startup-paired.mjs --baseline /absolute/baseline/dist --candidate /absolute/candidate/dist --output /absolute/new-evidence --latency 20 --throughput 4194304 --cpu 1 --pairs 5 --scenario settled
    node scripts/startup-summary.mjs /absolute/new-evidence
    node --test scripts/startup-summary.test.mjs

Параметры:
- baseline/candidate: готовые dist, а не ветки Git; CI checkout/build выполняет wrapper workflow.
- latency: миллисекунды RTT-эмуляции CDP; throughput: байты/с загрузки и отдачи; cpu: slowdown factor >=1. Профиль original:20/4194304/1. Менять профиль после просмотра результатов запрещено.
- pairs: заранее выбранное целое2..20, в каждой страте. Полная серия содержит pairs*32 наблюдений:390/1280 × DPR2/3 × reduce/no-preference × cold/warm × baseline/candidate. Warmup-навигации отдельно и не входят в размер измеренной серии.
- scenario settled: исторический путь — enabled, fonts.ready, networkidle, 1000ms settle, click; early: enabled и немедленный реальный click, диагностирует passive2s warmup. Серии разных сценариев не смешиваются. Early не подменяет исторический settled gate.
- cache: both (по умолчанию), cold или warm; при warm сначала полная priming-навигация в том же context.
- smoke: техническая проверка только390/DPR2/reduce. Результат всегда smoke-not-acceptance, даже если границы случайно благоприятны.

План записывается до браузера; существующий raw.json не перезаписывается, автоматически не возобновляется. Ошибка/неполнота — ошибка, не PASS. Запрещены выборочный отсев наблюдений и повторы до выгодного результата.

## Ручной CI (после инфраструктурного bootstrap)

Actions → Startup measurements → Run workflow. Ветка workflow выбирает код инструмента; baseline/candidate — refs целевых checkout, предпочтительно точные SHA. Прочие inputs совпадают с CLI. Последовательный runner, contents:read, persist-credentials:false, никаких deploy/secrets/Pages. Пример REST: POST /repos/litury/russian-checkers/actions/workflows/startup-measurements.yml/dispatches с ref ветки инструмента и inputs baseline,candidate,pairs,latency,throughput,cpu,scenario. Не запускать пока workflow не зарегистрирован и права не подтверждены.

Где числа: job Summary и artifact startup-<run_id>-<attempt>; summary.txt/summary.json, raw.json, manifest.json, browser.json, screenshots. Артефакт сохраняется даже при ошибке, retention90 дней. CI не должен выдавать зелёный технический job за QA PASS: читать result каждой страты. Baseline/candidate SHA и hashes инструмента сохраняются рядом с manifest; manifest содержит hashes обоих dist.

ResourceTiming показывает завершённые ответы. Поле network — CDP encodedDataLength завершённых загрузок, включая HTML; незавершённые запросы имеют end:null. Для веса до board-first-frame брать только ответы с end <= соответствующей метке; список in-flight анализировать отдельно. Не брать размер файла в репо за сетевой вес. Canvas не является LCP-элементом: LCP меню и first-frame игры анализируются раздельно. Метка игры также не доказывает физический compositor paint; реальный screenshot остаётся отдельным свидетельством.

## Этап 2

После подтверждённого branch CI: добавить GET-only live URL damka.fun в тот же измеритель, без guest/presence/API writes/WS; фиксировать фактический production build, wire weight и отличие host/cache/compression. Затем ночной schedule UTC на default branch и append-only журнал тренда (по run_id, времени, SHA/URL, профилю, размеру серии, страте). Сначала независимая проверка, затем включение расписания. Эта инфраструктура не исправляет сама по себе поздний первый кадр.
