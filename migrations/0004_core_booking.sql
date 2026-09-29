-- P0: normalized slots, bookings, attendance, programs, results, progression.
-- Coexists with studio_state JSON blob (dual-write path). Safe to apply once.

create table if not exists app_users (
  id text primary key,
  telegram_id text not null unique,
  role text not null check (role in ('client', 'trainer', 'admin')),
  first_name text not null default '',
  last_name text not null default '',
  username text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_users_role_idx on app_users (role);

create table if not exists training_slots (
  id text primary key,
  owner_coach_id text not null,
  starts_at timestamptz not null,
  timezone text not null default 'Europe/Minsk',
  duration_min integer not null default 60 check (duration_min > 0 and duration_min <= 480),
  capacity integer not null default 1 check (capacity > 0 and capacity <= 100),
  kind text not null default 'group' check (kind in ('individual', 'group', 'online')),
  status text not null default 'open' check (status in ('open', 'closed', 'cancelled')),
  location text,
  online_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists training_slots_owner_starts_idx
  on training_slots (owner_coach_id, starts_at);
create index if not exists training_slots_starts_idx on training_slots (starts_at)
  where status = 'open';

create table if not exists slot_bookings (
  id text primary key,
  slot_id text not null references training_slots (id) on delete cascade,
  client_id text not null,
  client_telegram_id text,
  status text not null default 'held'
    check (status in ('held', 'confirmed', 'cancelled', 'attended', 'no_show')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by text,
  unique (slot_id, client_id)
);

create index if not exists slot_bookings_client_idx on slot_bookings (client_id);
create index if not exists slot_bookings_slot_active_idx
  on slot_bookings (slot_id)
  where status in ('held', 'confirmed', 'attended');

create table if not exists session_attendance (
  id text primary key,
  booking_id text not null unique references slot_bookings (id) on delete cascade,
  marked_by text not null,
  attended boolean not null,
  marked_at timestamptz not null default now(),
  note text
);

create table if not exists client_programs (
  id text primary key,
  coach_id text not null,
  client_id text not null,
  title text not null,
  version integer not null default 1 check (version > 0),
  exercises jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coach_id, client_id, version)
);

create index if not exists client_programs_client_idx
  on client_programs (client_id, coach_id)
  where active = true;

create table if not exists session_results (
  id text primary key,
  booking_id text not null unique references slot_bookings (id) on delete cascade,
  program_id text references client_programs (id) on delete set null,
  program_version integer,
  client_id text not null,
  coach_id text not null,
  sets jsonb not null default '[]'::jsonb,
  rpe numeric(3,1),
  notes text,
  recorded_by text not null,
  recorded_at timestamptz not null default now(),
  unique (booking_id)
);

create index if not exists session_results_client_idx
  on session_results (client_id, recorded_at desc);

create table if not exists progression_rules (
  id text primary key,
  program_id text not null references client_programs (id) on delete cascade,
  rule_type text not null default 'double_progression'
    check (rule_type in ('double_progression', 'linear', 'manual_only')),
  config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists progression_suggestions (
  id text primary key,
  program_id text not null references client_programs (id) on delete cascade,
  client_id text not null,
  coach_id text not null,
  based_on_result_ids text[] not null default '{}',
  explanation text not null,
  proposed_change jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'manual', 'insufficient_data')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text
);

create index if not exists progression_suggestions_pending_idx
  on progression_suggestions (coach_id, status)
  where status = 'pending';

create table if not exists trainer_decisions (
  id text primary key,
  suggestion_id text not null references progression_suggestions (id) on delete cascade,
  decision text not null check (decision in ('accept', 'reject', 'manual')),
  decided_by text not null,
  decided_at timestamptz not null default now(),
  note text,
  manual_change jsonb
);

create index if not exists trainer_decisions_suggestion_idx
  on trainer_decisions (suggestion_id);
