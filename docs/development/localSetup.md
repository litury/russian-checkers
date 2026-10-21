# Локальный запуск на macOS

Игра: http://127.0.0.1:5173/ → «Играть» → «С ботом».
API: http://127.0.0.1:8787/health.

## Требования и зависимости

Нужны Node.js 22.12+ (рекомендуется актуальная LTS-версия), npm, Homebrew
и PostgreSQL 16. Docker для этой конфигурации не нужен.
Команды выполняются из корня проекта.

```sh
node --version
npm --version
brew install postgresql@16
npm ci
npm --prefix server ci
```

## База данных

Используется отдельный кластер в
`~/Library/Application Support/russian-checkers/local/pgdata`,
база `checkers`, роль `checkers`, порт `55439`. Не используйте существующую рабочую
базу: API при запуске применяет миграции.

Сначала проверьте, что порты свободны; не завершайте чужие процессы:

```sh
lsof -nP -iTCP:5173 -iTCP:8787 -iTCP:55439 -sTCP:LISTEN
```

Первичная инициализация, только если каталога `pgdata` ещё нет:

```sh
LOCAL_DIR="$HOME/Library/Application Support/russian-checkers/local"
mkdir -p "$LOCAL_DIR"
test ! -e "$LOCAL_DIR/pgdata" && \
  "$(brew --prefix postgresql@16)/bin/initdb" \
  -D "$LOCAL_DIR/pgdata" -U checkers \
  --auth=trust --encoding=UTF8 --locale=C
```

Кластер использует trust-аутентификацию: другие локальные процессы могут
подключаться без пароля. Ниже сервер привязывается только к loopback;
это окружение разработки для доверенного компьютера, не для публикации.

Первый и последующие запуски остановленной базы:

```sh
LOCAL_DIR="$HOME/Library/Application Support/russian-checkers/local"
"$(brew --prefix postgresql@16)/bin/pg_ctl" \
  -D "$LOCAL_DIR/pgdata" -l "$LOCAL_DIR/postgres.log" \
  -o "-h 127.0.0.1 -p 55439 -k '$LOCAL_DIR' -c shared_buffers=32MB -c max_connections=20" start
```

После первого запуска создайте базу (один раз):

```sh
"$(brew --prefix postgresql@16)/bin/createdb" \
  -h 127.0.0.1 -p 55439 -U checkers checkers
```

## API и игра

Из корня проекта, в двух отдельных терминалах:

```sh
HOST=127.0.0.1 PORT=8787 DATABASE_URL=postgres://checkers@127.0.0.1:55439/checkers npm --prefix server run dev
```

```sh
VITE_API_URL=http://127.0.0.1:5173 npm run dev -- --host 127.0.0.1 --port 5173
```

Не запускайте вторую копию, если эти порты уже заняты работающей игрой.
API автоматически применяет миграции: не подставляйте адрес рабочей базы.
Онлайн-режим здесь использует только локальный сервер, не публичных игроков.

## Остановка

Для серверов, запущенных в терминалах, нажмите `Ctrl+C` в каждом.
Для фоновых серверов сначала проверьте процессы:

```sh
lsof -nP -iTCP:5173 -iTCP:8787 -sTCP:LISTEN
```

Завершайте через `kill <PID>` только процессы этого проекта.
После остановки API остановите базу:

```sh
"$(brew --prefix postgresql@16)/bin/pg_ctl" \
  -D "$HOME/Library/Application Support/russian-checkers/local/pgdata" stop -m fast
```

Данные сохраняются; автозапуск при включении компьютера не настроен.
