# Структура ТЗ — статус (main)

Правило: завершить этап → проверки → P0 → следующий.

## ЭТАП 1. Надёжный тренировочный цикл

| § | Требование | Статус |
|---|------------|--------|
| 1.1 | initData server, роли | Done (код) |
| 1.2 | слоты, ёмкость, overlap, нет тихого переноса | **Done** (UI+rules+tests; store guards local) |
| 1.3 | карточка, явка, автор | Done |
| 1.4 | программа, результат, прогрессия | Done |
| 1.5 | Центр действий / Мой день | Done |
| 1.6 | unit concurrent/overlap/access | Done |
| — | Neon 0004 production | **Блокер** |
| — | Telegram e2e | **Владелец** |

**Выход этапа 1:** код готов; prod Neon + e2e — внешние.

## ЭТАП 2. Операции тренера

| § | Статус |
|---|--------|
| 2.1 шаблоны, копия, внимание, CSV local | Done |
| 2.2 habit, soft return, история, notify prefs | Done |
| 2.3 ICS/maps/QR/outbox | Done |
| 2.4 draft vs device | Базово |
| 2.5 CSV→Neon, durable outbox DB | Блокер Neon |

## ЭТАП 3. Натив
Не начат.

## Деплой
ruksha.vercel.app · main
