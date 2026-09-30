# Структура ТЗ — статус (main)

Правило: завершить этап → проверки → P0 → следующий.

## ЭТАП 1. Надёжный тренировочный цикл

| § | Требование | Статус |
|---|------------|--------|
| 1.1 | initData server, роли | Done |
| 1.2 | слоты, ёмкость, overlap | Done |
| 1.3 | карточка, явка, автор | Done |
| 1.4 | программа, результат, прогрессия | Done |
| 1.5 | Центр действий / Мой день | Done |
| 1.6 | unit concurrent/overlap/access | Done |
| — | Neon 0004/0005 production | **Done** (source=neon, tables present) |
| — | Telegram e2e | **Владелец** |

**Выход этапа 1:** код + Neon schema готовы; e2e в боте — владелец.

## ЭТАП 2. Операции тренера

| § | Статус |
|---|--------|
| 2.1 шаблоны, копия, внимание, CSV local | Done |
| 2.2 habit, soft return, история, notify prefs | Done |
| 2.3 ICS/maps/QR/outbox local | Done |
| 2.4 draft vs device | Базово |
| 2.5 durable outbox → Neon | **In progress** (persist on flush) |
| 2.5 CSV → Neon | Next |

## ЭТАП 3. Натив
Не начат.

## Деплой
ruksha.vercel.app · main · `/api/db-status` → neon + core tables
