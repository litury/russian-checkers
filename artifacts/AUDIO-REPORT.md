# t_d50b3179 — аудио: кандидат реализации

База: `a733b38b9c103ccb53d7ffa2370b7c07d82cbe78`. Работа только в текущем task worktree. Это авторская самопроверка, не независимый QA, не творческая приёмка и не deploy. Commit, push и действия с доской задач не выполнялись.

## Реализовано

- Владельцем duck является текущий `voice`. `sync`, позднее декодирование match bed и изменение настроек сохраняют понижение. `onended` заменённого голоса не снимает duck нового. Перед новой gain-автоматизацией отменяется предыдущая. Fade заменяемого голоса остаётся 50 мс, остановка назначается по AudioContext, без отложенного JS callback. Одновременно допускается текущий голос и один затухающий хвост.
- `gate_stop` потребляется один раз на lifecycle открытия, включая последовательность online `hide → beginMatch → hide`. Холодный, muted и reduced пропуски не догоняются позднее. Повторное online completion не обрывает первый gate stop.
- Повторный выбор той же клетки не повторяет ни material cue, ни утверждённый bark. Остальные старые character sounds, capture yells, promotion/trail и фразы сохранены.
- Категории SFX ограничены: UI — 2, piece — 4, scene/mechanism — 4 активных источника. При переполнении останавливается старейший источник своей категории. Голос имеет отдельное владение. Это ограничение одновременных источников, не обещание частотного rate-limit всех событий.
- `panel-ready` — только первое фактическое раскрытие всей rail Undo/Resign после готовности HUD, не по одной кнопке. Repaint, ход, Undo, pause и изменение disabled его не повторяют; новая партия получает новый lifecycle.
- `undo-applied` вызывается после успешного восстановления snapshot и refresh. Пустой stack, online, оконченная партия и штатный disabled button не создают cue.
- Quiet UI open/close/tap подключены к явным действиям Options, resign modal, online hub/search, valid room-code submission, истории/ручной навигации и result collapse/reopen/menu/again. Existing Settings/Help feedback сохранён; переход Options → дочерний dialog не добавляет второй close. Resign confirm не добавляет click/confirm поверх outcome. Программный dismiss resign не звучит.
- `draw-result` принадлежит только новому принятому результату в `presentResult`; повторный показ/раскрытие результата не повторяет outcome.
- У новых cues нет очереди. Сохранены trusted activation, master/effects/mute, independent hidden/platform pause, existing cold click deadline. Нет hover/tick/resize/polling/disabled звуков; новые audio fetch не стартуют до жеста. Правила, транспорт и таймеры не ждут звук.

## Явные исключения

**Connection lost/restored не добавлены.** Успешный disconnect/return с dedup на текущем коде не упражнялся; это разрешённое TASK-AUDIO исключение. Транспорт не исправлялся. Два реальных клиента проверяют opening/gameplay/resign, а не reconnect.

**Действующие select/move/capture/promotion не заменены.** Четыре новых кандидата доступны только в A/B-пакете, до выбора владельца после прослушивания. Все 68 старых аудиоассетов byte-identical базе, включая музыку и голоса: `checks/unchanged-assets.json`.

## Генерация и монтаж

Проверены live official OpenAPI `https://api.stability.ai/v2alpha/openapi`, страница API и загружаемый pricing bundle `https://platform.stability.ai/pricing`. Схема: `POST /v2beta/audio/stable-audio/text-to-audio`, multipart, `model=stable-audio-3`, `duration=1`, `output_format=wav`, `steps=8`, отдельный seed на запрос. Ответ 202, далее только GET результата. Не использовались выдуманный SFX endpoint, hosted Small, local model или другой платный провайдер.

Ровно **10 POST**, 10 полученных результатов, **0 автоматических повторов POST**. Шесть новых UI/panel/undo/draw кандидатов и четыре piece A/B. Лимит исчерпан; `generate.py` резервирует строку ledger до отправки и не повторяет уже зарезервированное имя. GET polling не является повторной генерацией.

Цена live schema и pricing bundle: 8 credits за успешную генерацию, $0.01 за credit. Поисковый cached extract показывал 26; противоречие сохранено в `audio/api-verification.json`, использованы live данные. Начальный баланс 989 — проверка родителя из задания; финальный GET /balance в этом проходе — HTTP 200, 909. Разница **80 credits ($0.80)** согласуется с десятью генерациями; отдельного billing invoice нет.

Исходные WAV и POST JSON сохранены без изменения. `audio/ledger.json`: prompt/model/params/seed, ordinal count, UTC, timings, HTTP status, generation ID, разрешённые response headers и polls. **finish-reason header сервер не прислал**; значение SUCCESS не выдумывалось. Ключ только из env, не печатался и не сохранялся.

`audio/process.py` декодирует ffmpeg, обрезает начальную тишину/максимальную длину, ставит короткие fades, снижает peak без усиления; PCM mono 44.1 kHz. `audio/measurements.json` содержит реальные duration/bytes/SHA256/peak dBFS/RMS dBFS и leading/trailing silence по порогу −50 dBFS до/после, плюс точный filter. RMS — не LUFS и не оценка воспринимаемой громкости. Остаточная тишина измерена, а не скрыта.

| Интегрированный кандидат | Длина | Размер | Peak dBFS | Runtime level до master/effects/SFX bus |
|---|---:|---:|---:|---:|
| ui-open | 0.22 с | 19482 B | −11.41 | 0.30 |
| ui-close | 0.20 с | 17718 B | −9.01 | 0.30 |
| ui-tap | 0.12 с | 10662 B | −9.01 | 0.30 |
| panel-ready | 0.18 с | 15954 B | −14.41 | 0.30 |
| undo-applied | 0.32 с | 28302 B | −9.01 | 0.30 |
| draw-result | 0.65 с | 57408 B | −9.01 | 0.50 |

Атаки/материал описаны как dry steel/electromechanical, no music/vocal/buildup. Это **prompts**, а не заявление о прослушанном тембре. Физического прослушивания не было.

A/B: `audio/review/*-AB.wav` = старый → 600 мс тишины → новый. Для move отдельно white и black. Рядом исходные old, candidate, RMS-matched individual файлы. Выравнивание только понижением до более тихого RMS; игровые оригиналы не меняются. Review ZIP содержит кандидаты, originals, provenance и scripts.

## Воспроизведение

Из корня worktree:

```sh
bash artifacts/checks/run-focused.sh
bash artifacts/browser/run-local.sh
```

Browser runner требует свободные 19452/19453/19454, уже установленный `postgres:16`, Docker socket, shared Playwright в `/home/hermes/.hermes/team/studio/browser-tools`, `/usr/local/bin/google-chrome`. Поднимает только свой контейнер/процессы, loopback bind, disposable DB, закрывает свои ресурсы. `generate.py` не входит в проверочные скрипты: повторный запуск тестов не делает платных запросов.

Браузер — отдельный headless Chrome с временным профилем и изолированными storage contexts; без Browser Use, CDP attach и личного браузера. HTTP/WS allowlist установлены **до navigation**: только exact hostname 127.0.0.1 и task ports. Для каждого клиента упражнены блокируемые внешние HTTP и WS sentinel. Это browser routing, не OS sandbox.

`browser/verify.mjs` оборачивает настоящие native AudioContext decode/source/gain methods и вызывает originals. Он не подменяет WAV, decode или source.start фиктивным успехом. Board interaction — mouse coordinates реальных клеток. Отдельно помеченные stimuli через DEV scene seam: speech replacement, draw, platform adapter; не выдаются за сыгранную ничью, реальный Yandex SDK или естественный time-low.

## Выполненные проверки и evidence

- `npm ci` и `npm ci --prefix server`: успешно, оба audit — 0 vulnerabilities. Логи `checks/npm-ci.log`, `checks/server-npm-ci.log`.
- Итоговые **166 tests / 14 files** прошли: `checks/unit-reviewed.log`. Cold/warm/autoplay deadlines, mute/master/effects/hidden/platform pause, owner replacement и old ended, late bed decode, gate dedup/cold consume, category concurrency, panel once, успешный/пустой/disabled Undo, same-square material+bark dedup, modal Continue/Escape/confirm, новый draw, existing voices/fire, matchmaking/hub.
- TypeScript `tsc --noEmit` и production Vite build: `checks/build-reviewed.log`. Остаётся существующее предупреждение Vite configLoader о расширении import; оно не исправлялось в аудиозадаче.
- `npm run check` **не проходит**. До правок: 476 errors / 245 warnings / 43 infos, `checks/check-baseline.log`. Итоговый проход с evidence-скриптами и JSON: 512 errors / 245 warnings / 44 infos, `checks/check-reviewed.log`. Новые diagnostics общего прохода включают форматирование проверочных артефактов; их нельзя назвать полностью старым долгом. Отдельная воспроизводимая проверка baseline/candidate каждого затронутого TS под той же Biome-конфигурацией (`checks/compare-biome.py`, `changed-files-biome.json`) показывает **одинаковые категории и количества diagnostics**, оба новых runtime TS проходят. Существующий стиль больших файлов массово не переписывался.
- `git diff --check`: без ошибок; 68 существующих assets сверены с HEAD, `checks/unchanged-assets.json`.
- Браузерные assertions: `browser/verification-summary.json`; native traces и их счётчики — `browser/*-trace.json`, `browser/trace-summary.json`. Desktop 1365×900; reduced mobile 390×844. Все семь storage contexts прошли внешний HTTP и WS sentinel block; page errors и HTTP >=400 в сохранённых успешных сценариях отсутствуют.
- Warm: настоящий menu→bot, mouse c3 трижды (select-b и bark по одному), c3→d4, ответ бота, Undo один раз, resign modal Continue, replacement voice/duck, adapter pause/resume, mute/unmute, resign confirm, result collapse/reopen/menu, следующая партия, injected draw и повторное раскрытие. В двух партиях gate_stop=2 и panel-ready=2, undo-applied=1, draw-result=1. После pause/mute возвращается только match loop, старые one-shots не догоняются.
- Cold: starts до жеста=0; после начала в этой среде только match loop. Slow play-b (900 мс сетевой задержки): play-b starts=0, позже match loop и актуальный panel-ready. Saved mute: starts=0. Reduced mobile: mechanism starts=0, только match loop. Это пропуски cold short cues по политике, не гарантированный звук первого клика.
- Два реальных current-code клиента: host/code/join/begin, accepted ply=1, полные `position` равны после анимации; gate_stop=1, panel-ready=1, turn-handoff=1 у каждого. Затем Continue в resign modal и подтверждённая сдача с результатом обоим. `browser/results.json`, `browser/run-online.log`, `browser/online-0.png`, `browser/online-1.png`. Network trace содержит настоящие ok/hosted/start/begin/move/end; auth tokens не логируются.
- Скриншоты визуально просмотрены для board и online orientation; modal/results/mobile файлы сохранены. Это не физическое прослушивание.

### Неудачные попытки сохранены

1. Начальный unit run: 135 прошли, один source-text assertion ожидал старую строку gate_stop. Assertion обновлён; поведение проверяется дополнительными runtime tests, итог 166/166.
2. Browser attempt 1: Options оставался modal и блокировал Play. Harness исправлен на Escape, без force click. `attempt-1-results.json`, `attempt-1-trace.json`.
3. Attempt 2: timeout ожидания старта; во время Vite run редактировался исходник, поэтому этот прогон не считается валидной проверкой стабильного кандидата. Последующие прогоны выполнены без изменения runtime исходников. `attempt-2-results.json`.
4. Attempt 3: все bot/cold/mute/mobile cases прошли, но online через Playwright relay не получил hosted code и показал offline. `attempt-3-results.json`, `attempt-3-online-a-trace.json`. Причина не установлена и не объявляется transport bug. Повторён только online: разрешённые loopback sockets оставлены native, все внешние по-прежнему routed-to-close до navigation. Этот прогон прошёл; игровой транспорт не менялся.

## Ограничения самопроверки

- Нет физического прослушивания, owner listening choice, телефона/наушников, Safari или независимого QA. PCM/starts/gains/screenshots не доказывают слышимость и художественную пригодность.
- Реальный document.hidden transition и настоящий Yandex SDK не упражнялись; hidden-policy покрыта unit, pause/resume в браузере — adapter callbacks через настоящую реализацию createYandexSdk.
- Cold first-click может остаться без short cue: просроченный эффект намеренно пропускается. Поздняя музыка допустима; late one-shot replay запрещён.
- Browser gameplay проверен на DEV current-source build с native WebAudio. Production tsc/Vite build отдельно проверен; runtime production-bundle прогон не заявляется.
- Время browser сценариев под общей нагрузкой не используется как измерение audio/input latency.
- Среда не предоставила runtime environment-status tool или `/etc/codex/network-policy.json`; это записанное ограничение metadata readiness. Credentials не инспектировались; использован явно разрешённый env key.

## Состояние передачи

Собственные API/Vite процессы остановлены после сверки PID и cwd, disposable DB container остановлен/удалён; task ports 19452/19453/19454 освобождены. Все Chrome contexts закрыты runner через finally. Чужие процессы и worktrees не изменялись. Изменения не staged и не закоммичены; исходный TASK-AUDIO.md сохранён.

Кандидат оставлен для независимого QA. Основные артефакты: этот отчёт, `audio-review.zip`, `audio/ledger.json`, `audio/measurements.json`, `browser/verification-summary.json`, native traces/screenshots и `checks/*`.

## Повторная проверка автора после CLI реализации

Повторно исполнен `bash artifacts/checks/run-focused.sh`: 166/166 tests, 14/14 files; tsc/Vite build и git diff --check прошли. Все 68 прежних audio assets неизменны. Ledger прочитан программно: 10 записей, все downloaded.

Полный `bash artifacts/browser/run-local.sh` повторно прошёл warm bot/duck/pause/Undo/modal/draw и cold/slow/muted/reduced-mobile, но online host code timeout на строке 69. Отрицательный результат сохранён как `browser/parent-recheck-failed-results.json` и отдельный online-a trace. Этот полный прогон НЕ объявляется зелёным. Причина timeout не установлена.

Первый немедленный повтор был остановлен проверкой портов из-за TIME_WAIT (ss не показал listening сокетов). Проверка свободного bind теперь задаёт SO_REUSEADDR, сохраняя запрет занятого listening порта. Затем `ONLINE_ONLY=1 bash artifacts/browser/run-local.sh` прошёл с exit 0: два native клиента host/join/begin, совпавшие позиции ply=1, gate_stop/panel-ready по одному, modal cancel/resign/outcome обоим. Результат последнего отдельного online — `browser/results.json`; внешний HTTP/WS sentinel заблокирован у обоих, page errors пусты. Транспорт не менялся. Это повторная авторская проверка, НЕ независимый QA.
