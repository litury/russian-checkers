# t_111f0fea — финальный авторский handoff для QA

## Статус и ревизии

Реализовано и локально проверено. Это НЕ независимый QA/PASS и не публикация.
Продолжен сохранённый кандидат 704d40bd2ed31223011ba1d8f1267792d8d2daba на базе f841b914469c08ac16c8886cd936305ef4e346ad. Финальный SHA указан в карточке после коммита этого отчёта.
Worktree: /home/hermes/projects/russian-checkers/.worktrees/t_111f0fea; ветка task/t_111f0fea-menu-ready.
Во время работы origin/main продвинулся до 99c12b9b8e3d27f685fb6adb10e24dbdec276a65: только board selection и два его теста (git diff f841b914 origin/main). Чужой срез не откатывался и не переносился. Финальный runtime сравнивался с pinned f841b914, НЕ с новым 99c12b9; сравнение интегрированного кандидата с новым main остаётся QA/последовательной интеграции. Не переносить diff текущего дерева против нового main целиком: cherry-pick только коммиты этой задачи.
AGENTS.md не менялся; прежний блокер снят оператором по объёму.

## Принятые изменения

- Сохранён атомарный ready/fallback из 704d40b: фон со статусом → ворота, заголовок, кнопки, статичные шашки. Deadline 2500 мс — потолок ошибки, не обязательная пауза. Error выбирает стабильный fallback без позднего арта.
- Анимационные слои не загружаются в уже уходящем/inert меню при committed Play. При возвращении enhancement снова допустим. Это снимает лишние запросы перед первым ходом, не удаляет пакеты.
- 68 eager audio fetch теперь получают priority=low (фактически подтверждено CDP). Набор, громкость, mute/autoplay, unlock, события, result hooks и API не менялись. Число/объём аудио НЕ уменьшены.
- В сценарии отсутствующего шрифта найден реальный unhandled rejection у двух bunkerPanel. Добавлен catch: остаётся системный шрифт, игра продолжается. Исполняемый regression test добавлен.

## Отвергнуто и не делалось

Build-only engine modulepreload тестировался отдельно: ранний fetch main не дал надёжного выигрыша пользовательскому сценарию, повышал конкуренцию/CPU; отключён и не входит в Vite config. Источники эксперимента enginePreload.* и candidate-after-clean оставлены локально как evidence, не в runtime.
Картинки не перекодировались: текущие WebP и responsive варианты уже измерены; металл, alpha, буквы и мастера не тронуты. Визуально проверены mobile/DPR2 и desktop/DPR2. Дополнительная компрессия и устранение скрытого полноразмерного cassette — возможная дальнейшая работа, НЕ реализованные оптимизации. Новые варианты по указанию оператора не исследуются.

## Методика и достоверность

Окончательные цифры: isolated-baseline/ и isolated-final/, по 3 cold + 3 HTTP-revalidation warm на 390×844 и 1440×900, DPR2, reduced motion. Google Chrome 154.0.8037.57, Node v26.10.0; CDP latency=40 мс, download=1 250 000 B/s, upload=625 000 B/s, CPU rate=1 (VPS, НЕ физический телефон). Cold очищает browser cache; warm повторяет навигацию в том же context. Service workers заблокированы; собственный HTTP allowlist proxy разрешает только конкретный preview origin; HTTPS CONNECT/WebSocket запрещены. API намеренно недоступен. Секреты не использованы.

Серия начата 2026-09-27 13:27 UTC после явного освобождения слота illustrator; перед запуском чужого headless не было. По окончании Chrome закрыт и slot передан назад t_5cad0d4f. Оба своих preview 4186/4187 (PID 570231/575218 с проверенными cwd внутри task worktree) остановлены и отсутствие PID проверено. Чужие процессы не затрагивались.

Ранние candidate-before-clean (704d40b), candidate-after-clean (modulepreload), candidate-final и trace/filmstrip оставлены для диагностики. Из-за сообщения о пересечении Chrome ранние performance-серии НЕ называются доказанно изолированными; не использовать их для вывода о превосходстве. Старый before warm оборван ENOSPC и исключён. Trace/screencast отдельно от итогового timing (они сами меняют CPU/paint). Никаких новых запусков после передачи слота.

TABLES.md содержит медианы И min–max всех повторов, а не лучший прогон. Данные — замеры малой выборки VPS, не доказательство статистической значимости. FirstPaint может быть фоном; whole — sampled DOM+decode критерий, отдельно подтверждён настоящим filmstrip. Playwright кликает после sampled whole; задержка доставки клика при занятом main thread включена в navigation→ход, но не в click→ход. Поэтому обязательно смотреть обе метрики. Реальный a3–b4 проверен по first-move-played, а не только first-move-allowed.

## Результат и оставшийся компромисс

Cold mobile: цельное меню 1545→1368 мс; navigation→реальный ход 7590→6484; click→ход 5808→4920. Cold desktop: меню 1540→1510; navigation→ход 10968→9882; click→ход 9396→8131.
Warm mobile: navigation→ход 7228→6183, но click→ход 4114→5310 (ухудшение), long-task sum 6323→7170 с широким диапазоном.
Warm desktop: меню 1165→1177 (не улучшилось); navigation→ход 12056→9537, но click→ход 6676→7763 (ухудшение). Cold desktop long-task sum также 10404→10969, хотя число long tasks снизилось.
Причина компромисса: baseline принимает клик позже из-за занятого main thread и уже успевшего стартовать engine; candidate раскрывает согласованное меню и раньше получает intent, но main import начинается после menu state. Фактический ход от навигации быстрее в медианах, посткликовое ожидание warm остаётся хуже. Безусловный PASS/«всё ускорено» НЕ заявляется. QA должен явно оценить этот tradeoff, не спрятать его за loader.

## Сеть и критический путь

Каждый raw JSON содержит requests CDP (инициатор/стек, timestamp, initialPriority/changes, response headers, timing, encoded bytes, redirects/errors), Resource Timing (start, request/response, transfer/encoded/decoded body), navigation, image.decode spans, shifts, long tasks, marks, Performance metrics. analysis.json — индекс с сетевыми таблицами, decode и дублями. Это эквивалент waterfall; точные строки по HTML/CSS/loader/main/gate/button/шашкам/fonts/API/audio читать там, а не восстанавливать по округлённому отчёту.

Пример isolated-final desktop cold repeat0: HTML 0→65.5 мс; loader 96.6→223.8; CSS 99.5→203.4; gate 89.5→1256.3, decode→1309.4; steel button 93.9→253.4; white/black endpoint start100→462.8/521.7; title1120 99.8→944.3; frame 264.2→1460.8, decode→1482.8; whole1503.9. Поэтому network finish gate ≠ показ целого меню: последним здесь был frame. main стартует1485.4→2034, затем выполнение/board/assets → allowed4896.8 → реальный ход9881.9. Нет фиксированного ожидания 2500 мс на нормальном пути.

Gate ~304k transfer, frame ~371k; responsive title1120 ~153k, title780 ~84k, full title ~205k также обнаружен (остаточный лишний запрос скрытой кассеты). Fonts ~83k; body JS main ~1.62MB decoded при ~488k transfer. Gate preloaded High, fonts VeryHigh; обычные audio теперь Low. Не повышать всё до High. Три decode gate соответствуют основному изображению и двум створкам; сеть gate одна, общий конец decode — это НЕ три независимые загрузки. В raw также видны повторные slate/board images, time-low/time-up и guest/presence retries; число request events не равно числу полных body передач.

До sampled whole mobile cold: 29 запросов/2 668 520 transfer B →22/1 959 404; desktop 30/2 821 722→23/2 112 606. Это все завершившиеся до границы ресурсы, НЕ только минимальный barrier. До хода mobile candidate ~6.64MB, из них audio 68 запросов/3 385 780 B. Звук не barrier, но остаётся CPU/network конкурентом. API colors/guest/presence ошибки и retries не задерживают ready/start; протокол/авторизация онлайн не менялись. Двухклиентная online партия в этой offline probe НЕ проверена.

Локальный Vite preview отдаёт no-cache+ETag; warm — реальная revalidation, gate transferSize=300, decodedBodySize=0 в Resource Timing этого запуска. HTML и JS gzip, WebP/woff2 без повторного gzip. Это не замер production CDN. DNS/TLS CDP=-1 означает неприменимо/не измерено (loopback HTTP), не нулевую интернет-задержку. Queue/stall не выводились простым вычитанием Resource Timing: смотреть CDP sendStart/connectStart/requestTime. Например fonts имеют sendStart ~178–356 мс после requestTime, то есть отсутствие DNS не означает отсутствие ожидания. Cross-origin API заблокирован; нули transfer/responseStart не означают мгновенный успешный ответ. Отдельного SW/CDN/серверного изменения не предлагается без production headers.

## Проверки и evidence

- Целевые tests readiness/coldStartup/opening/siegeLoading/optionsFire/perf/startup/gates/input/onlineRuntime/menuAudio/soundToggle/bunkerFontFailure: 137 passed; build (tsc+Vite) passed. Не полный регресс правил.
- functional-verified/summary.json: 13 сценариев + отдельный no-JS assert; mobile cold/repeat/delay/gate-error/piece-error/font-error/audio-error/late/slow/rotate/engine-error, desktop cold/repeat. 0 pageerror; проверяются fallback bounds, поздняя доставка, быстрый повторный click, настоящий ход, отсутствие непользовательских layout shift. Routing здесь только fault injection, их «warm» НЕ HTTP-cache benchmark.
- Обычная анимация: filmstrip-final/evidence.json + JPEG frames + contact.png, визуально кадры 1–4 фон/status → кадр5 полный комплект, без кадра конечных кнопок без ворот. Белый frame0 — about:blank. Desktop screenshot trace-final/1440-0-cold-menu.png также просмотрен.
- trace-final/*-trace.json: реальные devtools timeline с style/layout/paint; raw metrics отдельно. Пример desktop cold ScriptDuration1.281s, LayoutDuration0.057s, RecalcStyleDuration0.073s; decode/JS/paint нельзя подменять только временем сети.
- git diff --check и node --check обоих обновлённых probes пройдены.
- BFCache/cleanup — целевые unit-тесты; полноценная browser back-forward cache реставрация отдельно не воспроизведена. Аудио failure/unlock/mute тестируются, субъективное прослушивание не проведено.

## QA / интеграция

Передача в review reviewer=qa, не Done. Нужен независимый verdict по композиции/fallback и явно указанному warm click→ход компромиссу. Дополнительную исследовательскую оптимизацию автор не начинает. Hotspot menuAudio.ts согласован с t_425ff4cf: только fetch priority; result-часть не затрагивать. После независимого решения — последовательная интеграция относительно актуального main, проверка merged SHA и только затем разрешённая публикация. Push/deploy не выполнялись.
