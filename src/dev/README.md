# Локальный dev proxy

Vite слушает 127.0.0.1, strictPort=true. По умолчанию allowedHosts=[] (без allowedHosts:true); временных публичных доменов в исходниках нет. В игнорируемом `.env.local` можно задать DAMKA_DEV_ALLOWED_HOSTS как разделённый запятыми список точных lowercase DNS hostname без схемы, порта, wildcard или ведущей точки. Это проверка Host, не авторизация публичного стенда.

DAMKA_DEV_API_PORT — десятичный порт 1..65535, default 8787. Upstream фиксирован на 127.0.0.1, не на произвольный URL. HTTP /health, /stats, /presence, /players, /auth, /matches принимают границу `/`, `?` или конец. /ws принимает query или конец, но не /ws-extra. Совместимость query на upgrade должен обеспечивать также backend.

HOST backend по умолчанию остаётся `::`, как до изменения: это контейнерная совместимость, не усиление безопасности. Для локальной разработки обязательно HOST=127.0.0.1 и отдельный свободный PORT. HOST принимает IP либо localhost, пустое/неверное значение отклоняется. Лог показывает фактический listening address/port, включая brackets IPv6, а не обещанный loopback.

`src/online/apiOrigin.ts` не изменён: без VITE_API_URL на localhost/127.0.0.1 клиент идёт прямо на :8787, не через proxy. Для проверки локального same-origin явно задавать VITE_API_URL=http://127.0.0.1:<свой-порт-Vite>, DAMKA_DEV_API_PORT=<свой-порт-API>. Для внешнего hostname без override используется same-origin. Не указывать production API, не подключать проверку к занятым 5173/8787 или чужому туннелю. Изменения env требуют перезапуска только своего Vite.

Пример формы команды (порты сначала проверить на доступность): HOST=127.0.0.1 PORT=<API> и разрешённый disposable DATABASE_URL для server/src/index.ts; DAMKA_DEV_API_PORT=<API> VITE_API_URL=http://127.0.0.1:<VITE> vite --port <VITE>. API при старте вызывает существующий migration runner — не запускать с живой БД.
