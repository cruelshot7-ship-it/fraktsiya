-- Справочник продуктов из внешних источников (сейчас — USDA FoodData Central, CC0).
-- Отдельно от food_catalog (штрихкоды, введённые вручную) и от studio_state (клиентские данные).
-- Отсутствующее значение хранится как NULL, а не как ноль.
create table if not exists food_reference (
  id bigserial primary key,
  source text not null check (source in ('usda_fdc')),
  external_id text not null,
  data_type text,
  name text not null,
  state text not null default 'unknown' check (state in ('raw', 'cooked', 'fried', 'dry', 'unknown')),
  kcal_100 numeric,
  protein_100 numeric,
  fat_100 numeric,
  carbs_100 numeric,
  fiber_100 numeric,
  quality text not null default 'ok' check (quality in ('ok', 'incomplete', 'mismatch')),
  status text not null default 'imported' check (status in ('imported', 'verified')),
  import_run_id bigint,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id)
);

create index if not exists food_reference_name_idx on food_reference (lower(name));

-- Журнал импорта: что загружено, что пропущено, какие ошибки. Строки журнала не удаляются.
create table if not exists food_import_runs (
  id bigserial primary key,
  source text not null,
  file_name text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  total int not null default 0,
  imported int not null default 0,
  updated int not null default 0,
  unchanged int not null default 0,
  conflicts int not null default 0,
  skipped int not null default 0,
  errors int not null default 0,
  error_sample jsonb not null default '[]'::jsonb,
  status text not null default 'running' check (status in ('running', 'done', 'failed'))
);
