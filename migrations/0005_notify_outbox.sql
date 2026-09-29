-- Optional Stage 2: durable notification outbox.
-- DO NOT apply to production without explicit approval.

CREATE TABLE IF NOT EXISTS notify_outbox (
  id text PRIMARY KEY,
  kind text NOT NULL,
  telegram_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notify_outbox_pending_idx
  ON notify_outbox (status, created_at)
  WHERE status = 'pending';
