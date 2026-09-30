# Структура ТЗ — статус (main)

## ЭТАП 1. Надёжный тренировочный цикл — Done
| § | Статус |
|---|--------|
| 1.1–1.6 цикл | Done |
| Neon 0004/0005 | Done · canary ok · pooled URL |
| dual-write book/attendance | Done (runtime patch) |
| Telegram e2e | Владелец |

## ЭТАП 2. Операции тренера — Done (UI blocks)
| § | Статус |
|---|--------|
| 2.1 шаблоны, CSV | Done · CSV→Neon |
| 2.2 habit, soft return, notify | Done |
| 2.3 ICS/maps/QR/outbox | Done |
| 2.5 durable outbox + CSV Neon | Done |
| **UI блоки A–E** | **Done** Сегодня/Расписание/Программа|Клиенты/Ещё|Сигналы |
| store restore | Done (c1bc436) |

## ЭТАП 3. Натив
Не начат.

## Production
ruksha.vercel.app · `/api/db-status?canary=1`
