# t_e5970921 — цельный первый кадр меню (авторский отчёт)

## Кандидат и область

Срез c616187b6f096f6ff6ef10fd257481cdceca9f75 интегрирован без переписывания в ветку task/t_e5970921-coherent-menu. Исходная база dad87d03c127bea36c7c5165569fca0267add5b5; затем влит свежий main 53116bdc159cefefb4fd132201fab44c8abe1aad. Удалённый владельцем AGENTS.md не восстановлен, его правила никуда не переносились. Исторический evidence/menu-network сохранён.

- Сохраняется атомарный barrier минимального комплекта меню из исходного среза: gate/title/static endpoints/button/frame/шрифты вместе, deadline и терминальный fallback.
- Оценка модуля движка начинается после возможности отрисовать цельный кадр (двойной requestAnimationFrame, не фиксированный таймер).
- Полностью готовая кнопка требует framePresented + engineLoaded. В промежуточном состоянии «Загрузка…» native активация записывается в существующий pendingPlay/playIntent, а не теряется. Это приём намерения, не ложное объявление готовности движка.
- mountSiegeOpening получает live callback isPlayRequested. Чтение checkersStartup находится только в отдельном siegeOpeningBootstrap.ts, не в renderer.
- Заменены два сравнения порядка строк и запрет строки checkersStartup. Добавлены исполняемые тесты барьера, очереди, ошибки импорта; усиленный browser probe проверяет реальное касание.
- Browser выявил CLS текста «Загрузка…» → «С ботом». Резервирование прямоугольника подписи устранило сдвиг. Геометрия самих кнопок/арт не менялись.
- Дополнительных правок правил игры/HUD/спрайтов/звука поверх исходного среза нет. В исходном срезе есть его ранее подготовленные изменения menuAudio/bunkerFont — они сохранены, не расширены.

## Реальные проверки

- npm ci в собственные зависимости: выполнено; audit сообщает 2 moderate, автоматических исправлений не делалось.
- npm run build: exit 0 (включает tsc --noEmit). build.log. Предупреждения Vite о native config/import extension и отсутствующем VITE_API_URL; сеть изолирована, production API не использовался.
- npm test: 599/599, 123 файла, exit 0; tests-final.log.
- Реальный отдельный headless Chrome for Testing 154.0.8037.57, временные browser contexts, localhost 4262. Никакого attach/личного профиля. HTTP allowlist proxy и блокировка CONNECT/WS; без подставных игровых ответов.
- Cold/warm 390×844 и 1440×900: raw JSON final-timing-2/*.json, каждый видимый кадр целиком (gate/title/все кнопки/декодированные endpoints), CLS=0, pageerror=0, один trusted touch → доска и first-move-allowed без второго нажатия. Warm gate действительно из HTTP cache (transferSize=0), а не повторный запрос, названный тёплым.
- Queued: main JS удержан на HTTP proxy до настоящего touch. pendingPlay=true при engineLoaded=false; повторный native .click() подавлен; после отпускания запроса автоматически стартует доска. Оба размера.
- Resilience: gate/piece/font/audio failure, delayed и поздний gate после deadline, rotate, engine import failure; статичный fallback не блокирует старт. first-move-played реально достигнут в cold/font/audio сценариях. См. resilience/summary.json и resilience.log.
- Error/retry: реальная кнопка «Повторить загрузку» после отмены отказа → reload → новое единственное нажатие → first-move-allowed; retry/summary.json.
- Help/settings: устранён найденный на filmstrip отдельный показ «Опции» (текст, затем фон до меню). Все контролы теперь скрыты до цельного ready/fallback кадра; затем помощь/настройки доступны даже при удержанном main JS. Pointer/keyboard, диалог остаётся открыт при готовности движка, Escape возвращает фокус. evidence/menu-loading-controls/results.json.
- Reduced motion: browser contexts в timing/resilience имеют reduce; unit renderer проверяет остановку RAF и корректные endpoints. Реальное мобильное устройство не использовалось.
- Скриншоты 390/1440 просмотрены: полный арт, читаемые подписи, обрезания элементов нет. Filmstrip первых секунд снят отдельно от лёгких timing-замеров: захват изображений сам заметно тормозит software Chrome.

## Замеры, миллисекунды

Источник: final-timing-2/summary.json — финальный последовательный повтор после завершения браузера соседней задачи и исправления ранних «Опций».

| Размер / старт | Первый цельный кадр от navigation | Возможность записать tap после кадра | Реальный tap принят после кадра | От события tap до обработчика |
|---|---:|---:|---:|---:|
| 390 cold | 474.5 | 60.7 | 305.6 | 29.3 |
| 390 warm | 293.9 | 38.2 | 1223.9 | 166.0 |
| 1440 cold | 687.3 | 86.0 | 1540.1 | 1135.4 |
| 1440 warm | 672.7 | 80.6 | 4695.0 | 1560.7 |
| 390 queued | 536.8 | 44.2 | 169.1 | 34.4 |
| 1440 queued | 790.5 | 73.5 | 221.1 | 32.9 |

«Возможность записать tap» — наблюдение enabled на кадре, НЕ время фактического касания. «Принят» измерен bubble listener ПОСЛЕ shipping onclick. Последнее включает реальную задержку главного потока; frame→tap также включает транспорт автоматизации. Не выдаю 38–86ms за фактический input latency. Phaser/software rendering на этом VPS даёт заметную задержку; warm desktop 4.7s до принятия тестового tap и 1.56s от события до обработчика — ограничение, а не обещание мгновенного отклика на устройстве. QA должен отдельно оценить приемлемость задержки: локальный регрессионный потолок не означает хороший UX.

Регрессионные бюджеты не придуманы до измерения: budgets.json рассчитан scripts/coherent-menu-budget.cjs из timing-1/summary.json как 2× измеренный максимум с округлением вверх до 100ms: 200ms возможность записи, 5700ms кадр→принятый tap, 2000ms input handling. Это локальные широкие пределы для software Chrome, НЕ целевые UX/SLO. timing-3 и final-timing-2 прошли без увеличения этих пределов. timing-2 (220.9ms) и final-timing (260.4ms) честно сохранены как неуспешные при одновременном browser runtime коллеги. После координации повтор сделан последовательно.

## Повторение

npm ci (важно: сначала изолировать tracked node_modules symlink из main, см. ниже)
npm run build
./node_modules/.bin/vite preview --host 127.0.0.1 --port 4262 --strictPort
BUDGET=evidence/coherent-menu/budgets.json OUT=evidence/coherent-menu/recheck node scripts/coherent-menu-check.cjs
CAPTURE=1 OUT=evidence/coherent-menu/filmstrip-recheck node scripts/coherent-menu-check.cjs
ORIGIN=http://127.0.0.1:4262 node scripts/menu-ready-check.cjs evidence/coherent-menu/resilience-recheck
ORIGIN=http://127.0.0.1:4262 node scripts/menu-loading-controls.cjs

На main 53116bd случайно присутствует tracked symlink node_modules на общий каталог. Автор не менял общие зависимости: только в своём worktree symlink сохранён снаружи, npm ci установлено локально. Изменение node_modules не включается в кодовый коммит. Не запускать npm ci поверх общей ссылки при QA.

## Передача

Это реализация + авторская проверка, не независимый PASS. Preview: http://127.0.0.1:4262 (только локально на VPS). Онлайн-сервер/две сетевые партии, физическое устройство и production deploy не проверялись; task меняет стартовое меню, а не multiplayer. Перед публикацией QA должен fetch main, сохранить обе стороны изменений соседнего «В сети», проверить итоговый SHA и CI. Автор не пушил.
