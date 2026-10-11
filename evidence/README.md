# t_a6e6eadc — авторская самопроверка

База: e27a958bacf760164ff8a371fd82af76527d13f4. Preview: http://127.0.0.1:5196, task/t_a6e6eadc-resign-sheet.

Реализация: native dialog остаётся модальным до завершения выхода 280ms; Cancel/Esc/dismiss запускают выход, фокус возвращается после close. Повторное подтверждение во время отмены игнорируется. Confirm закрывает непосредственно перед прежним игровым callback, без задержки результата. destroy очищает таймер. Reduced motion — синхронное закрытие. Только псевдоэлемент материала получает transform. Мобильный лист: <=500px, ширина100%, нижний край, верхние радиусы20px; десктоп380x244 по центру. Материал и тексты сохранены.

Команды: npm ci (0 vulnerabilities); npm test -- src/client/app/resignConfirmation.spec.ts src/client/app/resignMotion.spec.ts src/client/app/matchActionMotion.spec.ts src/client/app/botUndo.spec.ts — 19/19; npm run build — успешно; git diff --check — успешно.

Реальный headless Chrome, временные раздельные context, внешние HTTP/WS заблокированы. node resign.browser.mjs: реальное меню → бот → окно сдачи → Продолжить, Esc, reduced motion, Сдаться → результат. Размеры390x844 и1280x844. Снимки comparison-* показывают сдачу/результат рядом. browser.json — геометрия и computed styles. У обеих кнопок корректный elementFromPoint при animationTime50 и300; trusted mouse click по координатам Continue запускает выход, фокус восстанавливается.

Важное ограничение замера: игровой main thread на этом хосте задерживает таймеры. Поэтому browser test задаёт currentTime CSS-анимаций50/300ms через Web Animations API и удерживает их для реального pointer hit test; это не wall-clock тап ровно через50/300ms. Unit fake timers отдельно проверяют отмену через50/300ms и закрытие только после280ms. Проверка обоих CSS hit targets проведена, но trusted touch с точным wall-clock50ms не заявляется. Онлайн, реальное устройство и прод не проверялись автором; публикации не было. Независимый QA должен проверить кандидата и после разрешённой публикации повторить сценарий damka.fun.
