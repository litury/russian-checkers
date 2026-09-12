# Реликварий: поле и фигуры

Независимая чистая доска, повторяющийся slate background и четыре фигуры (обычные/двухъярусные дамки). Ветер отключён. Старые животные не подключаются к новому полю; notePly оставлен как no-op для совместимости с текущим интерфейсом.

Пакет не включает отдельный WIP удаления старых meadow модулей/PNG, новые часы, меню или изменения правил. Старые preload-ресурсы пока остаются.

Проверка точного индекса в /tmp/reliquary-release.N2kDkA: 97 tests passed после исправления tablet bounds, tsc + production build passed. Рамка ограничена пропорциями 380/352 и 418/352; добавлен regression test 768x1024, сделан browser screenshot docs/reliquary-release-tablet.png. Baseline HEAD: 95 passed. Полный локальный worktree ранее: 97 passed (дополнительный тест meadow cleanup не входит в релиз).

Ограничения: 44 CSS px при 390x844, compact cells меньше; keyboard gameplay не реализован; старые selection/legal/last-move и capture VFX; физическое устройство не проверено; периметральные декали не размещены. Не полный accessibility pass.

Предыдущий browser smoke локального worktree: Playwright CLI reliquary, mobile/desktop, 64 центра touch targets на каждом из четырёх размеров; ход/взятие/обязательное взятие/превращение/рестарт. Тот же smoke затем повторён на изолированном релизном дереве (порт 5174, Playwright CLI reliquary-release): pass, 64/64 на каждом размере, ход/взятие/обязательное взятие/превращение/рестарт pass. Console: только 404 sdk.js и favicon.ico; игровая доска загружена.
