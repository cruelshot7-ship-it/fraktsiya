-- Shared product catalog: products the users enter by hand for a real barcode.
-- Open Food Facts records are NOT copied here: ODbL share-alike is a question for a lawyer.
create table if not exists food_catalog (
  barcode text primary key,
  name text not null,
  brand text,
  per100 jsonb not null,
  quantity text,
  serving_grams numeric,
  added_at timestamptz not null default now()
);
