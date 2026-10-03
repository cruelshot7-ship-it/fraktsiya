CREATE OR REPLACE FUNCTION enforce_slot_capacity()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  cap integer;
  active_count integer;
  target_slot text;
BEGIN
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  target_slot := NEW.slot_id;
  IF NEW.status = 'cancelled' THEN RETURN NEW; END IF;
  SELECT capacity INTO cap FROM training_slots WHERE id = target_slot FOR SHARE;
  IF cap IS NULL THEN
    RAISE EXCEPTION 'slot_missing: %', target_slot USING ERRCODE = 'foreign_key_violation';
  END IF;
  SELECT count(*)::integer INTO active_count
  FROM slot_bookings
  WHERE slot_id = target_slot AND status <> 'cancelled' AND id IS DISTINCT FROM NEW.id;
  IF active_count + 1 > cap THEN
    RAISE EXCEPTION 'slot_full: slot % capacity % active %', target_slot, cap, active_count
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS slot_bookings_capacity_guard ON slot_bookings;
CREATE TRIGGER slot_bookings_capacity_guard
  BEFORE INSERT OR UPDATE OF status, slot_id ON slot_bookings
  FOR EACH ROW EXECUTE FUNCTION enforce_slot_capacity();
