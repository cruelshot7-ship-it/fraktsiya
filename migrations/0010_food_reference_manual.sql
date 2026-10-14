-- Ручные продукты тренера в том же справочнике, что и USDA (как food_catalog для штрихкодов).
-- Существующие строки не меняются. Ручная запись обязана указать источник и не может подменить импорт.
alter table food_reference drop constraint if exists food_reference_source_check;
alter table food_reference add constraint food_reference_source_check check (source in ('usda_fdc', 'manual'));

alter table food_reference drop constraint if exists food_reference_status_check;
alter table food_reference add constraint food_reference_status_check check (status in ('imported', 'verified', 'manual'));

alter table food_reference add column if not exists source_note text;
alter table food_reference add column if not exists created_by text;

-- ручная запись — только со статусом manual, импортная — никогда
alter table food_reference drop constraint if exists food_reference_manual_status_check;
alter table food_reference add constraint food_reference_manual_status_check
  check ((source = 'manual') = (status = 'manual'));

-- у ручной записи источник обязателен
alter table food_reference drop constraint if exists food_reference_manual_note_check;
alter table food_reference add constraint food_reference_manual_note_check
  check (source <> 'manual' or (source_note is not null and length(btrim(source_note)) >= 3));
