import { useState } from "react";
import { getTelegramInitData } from "@/lib/telegram";
import { useStudio } from "@/lib/studio-store";
import { neonBookingId } from "@/lib/booking/client-dual-write";
import { SectionLabel, Surface } from "@/components/app/bits";

type SetRow = {
  exercise: string;
  load: string;
  reps: string;
  targetRepsMin: string;
  targetRepsMax: string;
  setsCompleted: string;
  setsPlanned: string;
  unit: "kg" | "lb" | "bw";
};

const emptyRow = (): SetRow => ({
  exercise: "",
  load: "",
  reps: "",
  targetRepsMin: "8",
  targetRepsMax: "12",
  setsCompleted: "3",
  setsPlanned: "3",
  unit: "kg",
});

type Props = {
  bookingId: string;
  clientId: string;
  coachId: string;
  attendanceConfirmed: boolean;
  programId?: string;
};

/** Fact for session → server when available, else device. Requires attendance. */
export function SessionResultForm({
  bookingId,
  clientId,
  coachId,
  attendanceConfirmed,
  programId,
}: Props) {
  const showToast = useStudio((s) => s.showToast);
  const role = useStudio((s) => s.role);
  const [rows, setRows] = useState<SetRow[]>([emptyRow()]);
  const [rpe, setRpe] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  if (!attendanceConfirmed) {
    return (
      <Surface glow="alert">
        <SectionLabel>Результат занятия</SectionLabel>
        <p className="mt-2 text-sm text-muted-foreground">
          {role === "trainer"
            ? "Отметьте явку участника, затем зафиксируйте подходы. Истечение времени слота ≠ посещение."
            : "Сначала отметьте явку. Без явки результат не сохраняется."}
        </p>
      </Surface>
    );
  }

  function updateRow(i: number, patch: Partial<SetRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function submit() {
    const initData = getTelegramInitData();
    if (!initData) {
      showToast("Откройте Mini App из Telegram.");
      return;
    }

    const sets = rows
      .filter((r) => r.exercise.trim())
      .map((r) => ({
        exercise: r.exercise.trim(),
        load: r.unit === "bw" ? 0 : Number(r.load) || 0,
        unit: r.unit,
        reps: Number(r.reps) || 0,
        targetRepsMin: Number(r.targetRepsMin) || 0,
        targetRepsMax: Number(r.targetRepsMax) || 0,
        setsCompleted: Number(r.setsCompleted) || 0,
        setsPlanned: Number(r.setsPlanned) || 0,
      }));

    if (!sets.length) {
      showToast("Добавьте хотя бы одно упражнение.");
      return;
    }

    setBusy(true);
    try {
      const { recordSessionResultFn } = await import("@/lib/booking/server");
      const store = useStudio.getState();
      const local = store.bookings.find((b) => b.id === bookingId);
      const serverBookingId =
        local?.slotId && local?.clientId
          ? neonBookingId(local.slotId, local.clientId)
          : bookingId;
      const res = await recordSessionResultFn({
        data: {
          initData,
          bookingId: serverBookingId,
          clientId,
          coachId,
          programId,
          sets,
          rpe: rpe ? Number(rpe) : undefined,
          notes: notes.trim() || undefined,
        },
      });
      if (res.ok) {
        setSavedId(res.resultId);
        showToast(res.created ? "Результат сохранён на сервере." : "Результат уже был (без дубля).");
        return;
      }
      if (res.reason === "no-attendance") {
        showToast("Сначала отметьте явку.");
        return;
      }
      const { saveLocalResult, findLocalResult } = await import("@/lib/session-results-local");
      const existing = findLocalResult(bookingId);
      if (existing) {
        setSavedId(existing.id);
        showToast("Уже сохранено на устройстве (без дубля).");
        return;
      }
      const localRes = saveLocalResult({
        id: `local_res_${bookingId}`,
        bookingId,
        clientId,
        coachId,
        programId,
        sets,
        rpe: rpe ? Number(rpe) : undefined,
        notes: notes.trim() || undefined,
        at: new Date().toISOString(),
      });
      setSavedId(localRes.id);
      showToast("Сохранено на устройстве. Сервер — после Neon.");
    } catch {
      try {
        const { saveLocalResult, findLocalResult } = await import("@/lib/session-results-local");
        const existing = findLocalResult(bookingId);
        if (existing) {
          setSavedId(existing.id);
          showToast("Уже на устройстве.");
          return;
        }
        const localRes = saveLocalResult({
          id: `local_res_${bookingId}`,
          bookingId,
          clientId,
          coachId,
          programId,
          sets,
          rpe: rpe ? Number(rpe) : undefined,
          notes: notes.trim() || undefined,
          at: new Date().toISOString(),
        });
        setSavedId(localRes.id);
        showToast("Сохранено на устройстве (офлайн).");
      } catch {
        showToast("Не удалось сохранить. Повторите.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Surface glow={savedId ? "ok" : undefined}>
      <SectionLabel>Результат занятия</SectionLabel>
      <p className="mt-1 text-tiny text-muted-foreground">
        Факт привязан к этой записи. Повтор не создаёт дубль.
      </p>
      {savedId ? <p className="mt-3 text-sm text-ok">Сохранено · {savedId}</p> : null}
      <div className="mt-3 space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="rounded-xl bg-secondary/40 p-3 space-y-2">
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="Упражнение"
              value={row.exercise}
              onChange={(e) => updateRow(i, { exercise: e.target.value })}
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                className="rounded-lg border border-border bg-background px-2 py-2 text-sm"
                inputMode="decimal"
                placeholder="Вес"
                value={row.load}
                disabled={row.unit === "bw"}
                onChange={(e) => updateRow(i, { load: e.target.value })}
              />
              <input
                className="rounded-lg border border-border bg-background px-2 py-2 text-sm"
                inputMode="numeric"
                placeholder="Повт."
                value={row.reps}
                onChange={(e) => updateRow(i, { reps: e.target.value })}
              />
              <select
                className="rounded-lg border border-border bg-background px-2 py-2 text-sm"
                value={row.unit}
                onChange={(e) => updateRow(i, { unit: e.target.value as SetRow["unit"] })}
              >
                <option value="kg">кг</option>
                <option value="lb">lb</option>
                <option value="bw">вес тела</option>
              </select>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <input
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                inputMode="numeric"
                placeholder="мин"
                value={row.targetRepsMin}
                onChange={(e) => updateRow(i, { targetRepsMin: e.target.value })}
                aria-label="Целевые повторы мин"
              />
              <input
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                inputMode="numeric"
                placeholder="макс"
                value={row.targetRepsMax}
                onChange={(e) => updateRow(i, { targetRepsMax: e.target.value })}
                aria-label="Целевые повторы макс"
              />
              <input
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                inputMode="numeric"
                placeholder="сдел."
                value={row.setsCompleted}
                onChange={(e) => updateRow(i, { setsCompleted: e.target.value })}
                aria-label="Подходы сделано"
              />
              <input
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                inputMode="numeric"
                placeholder="план"
                value={row.setsPlanned}
                onChange={(e) => updateRow(i, { setsPlanned: e.target.value })}
                aria-label="Подходы план"
              />
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="mt-2 text-xs text-primary" onClick={() => setRows((r) => [...r, emptyRow()])}>
        + упражнение
      </button>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <input
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          inputMode="decimal"
          placeholder="RPE (необяз.)"
          value={rpe}
          onChange={(e) => setRpe(e.target.value)}
        />
        <input
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder="Заметка"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void submit()}
        className="pressable mt-3 h-12 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Сохраняем…" : "Сохранить результат"}
      </button>
    </Surface>
  );
}
