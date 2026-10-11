# Технический аудит

База: `origin/main` = `db1bf81`. Статусы — см. `EXECUTIVE_SUMMARY.md`. Тесты и сборка не запускались (Н).

## 1. Оценка по направлениям

| Направление | Оценка | Основание |
|---|---|---|
| Архитектура | Средняя | Один blob + реляционные таблицы без единого источника истины (`CURRENT_ARCHITECTURE.md`) |
| Backend / API | Слабая | Часть функций не проверяет ресурс по владельцу (F-02, F-15) |
| Frontend | Средняя | Zustand-стор большой, ветвление по роли внутри одного стора |
| База данных | Слабая | Транзакции не атомарны на Neon (F-01); миграции без контроля (F-05) |
| Типизация и валидация | Хорошая | zod на входах `createServerFn` (К) |
| Обработка ошибок | Слабая | Ошибки глотаются (F-04); `StateConflictError` в `/api/health` не обработан (К, `src/routes/api/health.ts:54`) |
| Конфигурация и секреты | Слабая | Константа-секрет в git (F-06); два набора env (Vercel/Railway) |
| Зависимости | Слабая | Нет lock-файла (F-13); неиспользуемые пакеты (см. раздел 4) |
| Миграции | Слабая | Все `.sql` верхнего уровня, без подтверждения (F-05) |
| Логирование и мониторинг | Слабая | Только `console.error`; нет трекинга ошибок (см. `SUPPORT_AND_OPERATIONS.md`) |
| Тестируемость | Средняя | Чистые функции хорошо покрыты; серверные пути — нет (F-14) |
| Масштабируемость | Не оценивалась | Нагрузочных тестов нет; заявлять нельзя (К) |

## 2. Транзакции и пул

`src/lib/db.ts:77-80`: каждый `sql.query` — отдельный `pool.query`. Явные `begin`, `pg_advisory_xact_lock`, `commit` в `bookSlotFn`, `recordSessionResultFn`, `markAttendanceFn`, `suggestProgressionFn` выполняются как независимые запросы. Для `node-postgres` это означает, что они могут уйти на разные соединения. Тогда:

- `begin` и `commit` не образуют транзакцию;
- `pg_advisory_xact_lock` держится до конца **неявной** транзакции одного запроса и снимается сразу;
- следствие — F-01.

Хуже, чем потеря атомарности: открытый `begin` на соединении пула может захватить запросы другого запроса, а чужой `rollback` — откатить их (подтверждено рецензентом). Исправление: один клиент на весь блок (`pool.connect()` → `client.query` → `release()`), либо одна SQL-функция в БД.

## 3. Ошибки и соглашения

- `telegram-auth.server.ts` возвращает `null` при любой ошибке (К). Это хорошо для безопасности, но логов причины нет.
- `bookSlotFn` в `catch` возвращает `server-error` и не различает `slot_full` от триггера (Ч, `src/lib/booking/server.ts:132-141`).
- `db.ts`: `ssl: { rejectUnauthorized: false }` (К, `:77`; `scripts/migrate.mjs:42`). Это отключает проверку сертификата сервера. Исправить: проверять CA Neon.
- `dbSource` вычисляется при первом обращении и может расходиться с `getDbSource()` (К, `db.ts:31, 150`).

## 4. Зависимости

Не импортируются в `src`, `server`, `scripts` или `vite.config.ts` (Ч): `@tanstack/react-query`, `date-fns`, `react-day-picker`, `tw-animate-css`, `camera-controls`, `three-stdlib`, `lightningcss`, Radix-пакеты (кроме используемых в `components/app`); каталог `src/components/ui/` не импортируется ни одним файлом (Ч).

В основном клиентском чанке: `recharts` (`program-view.tsx`, `clients-view.tsx`) и `qrcode` (`trainer-share.tsx`) (Ч). `@shadergradient/react` грузится отдельно (Ч).

Что проверить: `npm ls` и размер бандла после `npm ci` (Н).

## 5. Конфигурация

- `VITE_AUTH_ENABLED` читается только скриптами сборки и комментарием в `src/lib/auth/middleware.ts:22` (Ч). `authMiddleware` не используется и импортирует отсутствующий `./verify.server` (Ч, `middleware.ts:42`). Это мёртвый код, который обещает защиту и не защищает.
- `ALLOW_PGLITE` описан в `.env.example:11`, нигде не читается (К).
- `startup.sh` и `package.json` scripts `preview:restart`, `preview:stop` ссылаются на отсутствующий `scripts/preview.mjs` (К).

## 6. Технический долг, который стоит убрать

1. `src/lib/auth/middleware.ts`, `src/lib/auth/preview.ts`, `src/lib/app-data/readiness.ts` — мёртвый код (Ч).
2. `src/data/scan.ts` — дубль каталога штрихкодов (К).
3. `src/components/ui/` и неиспользуемые Radix-пакеты (Ч).
4. `migrations/auth/0001_auth.sql` — не применяется, не используется (Ч, `scripts/migration-plan.mjs:11-12`).
5. `startup.sh` — мёртв (К).

Удаление мёртвого кода — отдельная задача без изменения поведения; делать с тестами, не смешивая с исправлениями P0.

## 7. Зоны, где нельзя менять без плана

- Схему `studio_state` и формат `payload.rev` (CAS-запись опирается на `payload->>'rev'`).
- Порядок записи в `commitStudioState` (CAS → визиты → Telegram-копия → дневная копия).
- Миграции, уже применённые в проде.
