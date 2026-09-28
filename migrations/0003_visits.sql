create table if not exists studio_state_backup (
  id text not null,
  payload jsonb not null,
  copied_at timestamptz not null default now()
);

insert into studio_state_backup (id, payload)
select id, payload from studio_state
where not exists (
  select 1 from studio_state_backup
  where studio_state_backup.id = studio_state.id
    and studio_state_backup.copied_at::date = now()::date
);

create table if not exists visits (
  id text primary key,
  client_id text not null,
  date text not null,
  at timestamptz not null default now(),
  water_ml integer not null default 0
);
