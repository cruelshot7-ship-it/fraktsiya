-- Одноразовые уведомления клиентам: текст хранится до открытия или до срока, затем стирается.
-- В чат уходит только кнопка. Таблица новая, существующие таблицы не меняются.
create table if not exists client_notices (
  id bigserial primary key,
  telegram_id text not null,
  body text not null,
  chat_message_id bigint,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  opened_at timestamptz
);

create index if not exists client_notices_expires_idx on client_notices (expires_at);
create index if not exists client_notices_telegram_idx on client_notices (telegram_id);
