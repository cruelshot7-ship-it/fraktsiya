# Структура ТЗ — статус (main)

## ЭТАП 1. Надёжный тренировочный цикл — Done (код + Neon)

| § | Статус |
|---|--------|
| 1.1–1.6 цикл | Done |
| Neon 0004/0005 | Done · canary ok · pooled URL |
| Telegram e2e | Владелец |

## ЭТАП 2. Операции тренера

| § | Статус |
|---|--------|
| 2.1 шаблоны, CSV local | Done |
| 2.2 habit, soft return, notify | Done |
| 2.3 ICS/maps/QR/outbox local | Done |
| 2.4 draft vs device | Базово |
| 2.5 durable outbox → Neon | Done |
| 2.5 CSV → Neon app_users | **Done** (dual-write) |

## ЭТАП 3. Натив
Не начат.

## Деплой
ruksha.vercel.app · `/api/db-status?canary=1`
