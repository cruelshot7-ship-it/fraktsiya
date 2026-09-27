import { isoDate, type DayCheck } from "@/data/studio";

type Bucket = { steps?: number; sleep?: number; water?: number; move?: number };

function num(value: unknown) {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function dayKey(raw: unknown) {
  const text = String(raw ?? "");
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  return match?.[1] || isoDate(new Date());
}

function bucket(days: Map<string, Bucket>, raw: unknown) {
  const key = dayKey(raw);
  const row = days.get(key) ?? {};
  days.set(key, row);
  return row;
}

export function healthDays(body: Record<string, unknown> | null) {
  const days = new Map<string, Bucket>();
  if (!body) return days;
  if ("steps" in body || "sleepHours" in body || "sleep" in body || "moveMin" in body || "waterMl" in body || "exercise" in body || "water" in body) {
    const row = bucket(days, body.date);
    if ("steps" in body) row.steps = num(body.steps);
    if ("sleepHours" in body || "sleep" in body) row.sleep = num(body.sleepHours ?? body.sleep);
    if ("moveMin" in body || "exercise" in body) row.move = num(body.moveMin ?? body.exercise);
    if ("waterMl" in body || "water" in body) row.water = num(body.waterMl ?? body.water);
  }
  const wrapped = body.data && typeof body.data === "object" ? (body.data as Record<string, unknown>) : null;
  const metrics = Array.isArray(body.metrics) ? body.metrics : Array.isArray(wrapped?.metrics) ? wrapped.metrics : [];
  for (const metric of metrics) {
    if (!metric || typeof metric !== "object") continue;
    const row = metric as Record<string, unknown>;
    const name = String(row.name ?? "").toLowerCase();
    const units = String(row.units ?? "").toLowerCase();
    const points = Array.isArray(row.data) ? row.data : [];
    for (const point of points) {
      if (!point || typeof point !== "object") continue;
      const sample = point as Record<string, unknown>;
      const day = bucket(days, sample.date || sample.startDate);
      const qty = num(sample.qty ?? sample.value);
      if (name === "step_count") day.steps = (day.steps ?? 0) + qty;
      else if (name === "sleep_analysis") {
        const hours = num(sample.totalSleep ?? sample.asleep ?? (units.startsWith("hr") ? qty : 0));
        if (hours > 0) day.sleep = Math.max(day.sleep ?? 0, hours);
      } else if (name === "apple_exercise_time" || name === "apple_move_time") {
        day.move = (day.move ?? 0) + (units.includes("hr") ? qty * 60 : qty);
      } else if (name === "dietary_water") {
        day.water = (day.water ?? 0) + (units === "l" || units === "liter" || units === "liters" ? qty * 1000 : qty);
      }
    }
  }
  const workouts = Array.isArray(body.workouts) ? body.workouts : Array.isArray(wrapped?.workouts) ? wrapped.workouts : [];
  for (const workout of workouts) {
    if (!workout || typeof workout !== "object") continue;
    const row = workout as Record<string, unknown>;
    const day = bucket(days, row.start || row.startDate || row.date);
    const duration = num(row.duration ?? row.durationMin);
    const minutes = duration > 600 ? duration / 60 : duration;
    if (minutes > 0) day.move = Math.max(day.move ?? 0, minutes);
  }
  return days;
}

export function applyHealthDays(current: DayCheck[], clientId: string, days: Map<string, Bucket>) {
  const next = current.slice();
  let updated = 0;
  for (const [date, row] of days) {
    if (row.steps == null && row.sleep == null && row.water == null && row.move == null) continue;
    const id = `${clientId}:${date}`;
    const prev = next.find((item) => item.id === id);
    const merged: DayCheck = {
      id,
      clientId,
      date,
      steps: Math.round(row.steps ?? prev?.steps ?? 0),
      sleepHours: Math.round((row.sleep ?? prev?.sleepHours ?? 0) * 10) / 10,
      waterMl: Math.round(row.water ?? prev?.waterMl ?? 0),
      moveMin: Math.round(row.move ?? prev?.moveMin ?? 0),
      moveKind: prev?.moveKind || "Часы",
      source: "apple",
    };
    const index = next.findIndex((item) => item.id === id);
    if (index >= 0) next[index] = merged;
    else next.push(merged);
    updated += 1;
  }
  return { dayChecks: next, updated };
}
