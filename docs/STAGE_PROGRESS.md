# Progress vs instruction (feature/action-center-session-card)

## Этап 1
| Требование | Статус |
|------------|--------|
| Бронь + dual-write | Done |
| Карточка / явка / результат | Done |
| Прогрессия + решение | Done |
| Центр действий | Done |
| Unit-тесты concurrent/access | Done |
| Neon 0004 prod | **Блокер: OK** |
| Telegram e2e | **Владелец** |

## Этап 2
| Требование | Статус |
|------------|--------|
| Шаблоны / копия / история | Done |
| Внимание: без записи / перерыв | Done |
| CSV + дубликаты (локально) | Done |
| CSV → Neon | **Нет** |
| Habit / soft return / ICS / maps / QR | Done |
| Outbox + bot flush | Done |
| SyncStatusChip | Done |

## Этап 3
Не начат.

## Безопасность
Feature branch. Миграции Neon агентом не применялись. Deploy: ruksha.vercel.app
