-- Журнал уведомлений, которые бот отправил от своего имени. Нужен, чтобы удалить их через сутки.
-- Строки удаляются только вместе с сообщением в чате: тексты здесь не хранятся.
create table if not exists bot_messages (
  id bigserial primary key,
  chat_id text not null,
  message_id bigint not null,
  kind text not null check (kind in ('notify', 'reminder', 'digest')),
  sent_at timestamptz not null default now(),
  delete_after timestamptz not null,
  deleted_at timestamptz,
  attempts int not null default 0,
  last_error text,
  unique (chat_id, message_id)
);

create index if not exists bot_messages_due_idx
  on bot_messages (delete_after)
  where deleted_at is null;
