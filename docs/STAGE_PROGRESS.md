# Progress checklist (feature/action-center-session-card)

Do not treat this as “production closed” until Neon migrate + Telegram e2e are green.

## Stage 1 — training cycle

| Item | Status |
|------|--------|
| Slot → book (concurrency rules + dual-write path) | Done (code) |
| Attendance before result | Done |
| Session result form (server) | Done |
| Progression suggestion + trainer decide | Done |
| Action Center | Done |
| Session card phases | Done |
| Access rules (coach isolation) unit tests | Done |
| Production Neon migrate 0004 | **Blocked — needs your OK** |
| Real Telegram e2e on device | **Your check** |

## Stage 2 — trainer ops

| Item | Status |
|------|--------|
| ICS calendar | Done |
| Maps route (no GPS) | Done (needs location on slot) |
| Soft return after break | Done |
| Habit one-tap slot | Done |
| Templates (assign = client copy) | Done (seed template) |
| Copy program day | Done |
| Program change history (from notices) | Done |
| Trainer QR / share link | Done |
| CSV preview | Done |
| CSV → local clients (explicit confirm) | Done |
| CSV → Neon / production DB | **Not enabled** |
| Notify outbox (local + SQL 0005 file) | Done local; bot worker **not** wired |
| Bot delivery with retry | Partial (logic + local flush) |

## Stage 3

Native apps — not started (by design).

## Safety

- Branch only: `feature/action-center-session-card`
- No merge to main without review
- Migrations 0004/0005 not applied to production from this agent
