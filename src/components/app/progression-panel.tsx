import { useState } from "react";
import { getTelegramInitData } from "@/lib/telegram";
import { useStudio } from "@/lib/studio-store";
import { Surface, SectionLabel } from "@/components/app/bits";
import {
  suggestProgression,
  type ProgressionSuggestion,
} from "@/lib/progression/engine";

type Props = {
  clientId: string;
  coachId: string;
  programId?: string;
};

/** Trainer-only: explainable progression; server when ready, else local results. */
export function ProgressionPanel({ clientId, coachId, programId }: Props) {
  const showToast = useStudio((s) => s.showToast);
  const role = useStudio((s) => s.role);
  const notices = useStudio((s) => s.notices);
  const [busy, setBusy] = useState(false);
  const [suggestionId, setSuggestionId] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<ProgressionSuggestion | null>(null);
  const [source, setSource] = useState<"server" | "local" | null>(null);
  const [note, setNote] = useState("");

  if (role !== "trainer") return null;

  const pid = programId || `prog_${coachId}_${clientId}`;

  function pushClientDecision(decision: "accept" | "reject" | "manual", text: string) {
    const title =
      decision === "accept"
        ? "Решение: нагрузка обновлена"
        : decision === "reject"
          ? "Решение: план без изменений"
          : "Решение: ручная правка плана";
    const body = note.trim() || text;
    const id = `nt_prog_${clientId}_${Date.now()}`;
    const next = [
      {
        id,
        audience: "client" as const,
        clientId,
        kind: "progression" as const,
        title,
        body,
        at: new Date().toISOString(),
      },
      ...notices,
    ].slice(0, 80);
    useStudio.setState({ notices: next });
    try {
      const snap = localStorage.getItem("ruksha_studio_v1");
      if (snap) {
        const parsed = JSON.parse(snap) as { notices?: typeof next };
        parsed.notices = next;
        localStorage.setItem("ruksha_studio_v1", JSON.stringify(parsed));
      }
    } catch {
      /* ignore */
    }
  }

  async function requestSuggestionLocal() {
    const { loadLocalResults } = await import("@/lib/session-results-local");
    const local = loadLocalResults().filter((r) => r.clientId === clientId);
    const inputs = local.map((r) => ({
      id: r.id,
      recordedAt: r.at,
      sets: r.sets.map((s) => ({
        exercise: s.exercise,
        load: s.load,
        unit: (s.unit === "lb" || s.unit === "bw" ? s.unit : "kg") as "kg" | "lb" | "bw",
        reps: s.reps,
        targetRepsMin: s.targetRepsMin,
        targetRepsMax: s.targetRepsMax,
        setsCompleted: s.setsCompleted,
        setsPlanned: s.setsPlanned,
      })),
      rpe: r.rpe,
    }));
    const sug = suggestProgression(inputs);
    setSuggestionId(`local_sug_${clientId}_${Date.now()}`);
    setSuggestion(sug);
    setSource("local");
    if (sug.status === "insufficient_data") {
      showToast("Мало данных на устройстве. Нужно ≥2 результата с подходами.");
    } else {
      showToast("Предложение по локальным результатам.");
    }
  }

  async function requestSuggestion() {
    const initData = getTelegramInitData();
    if (!initData) {
      showToast("Откройте из Telegram.");
      return;
    }
    setBusy(true);
    try {
      const { suggestProgressionFn } = await import("@/lib/progression/server");
      const res = await suggestProgressionFn({
        data: { initData, programId: pid, clientId, coachId },
      });
      if (res.ok) {
        setSuggestionId(res.suggestionId);
        setSuggestion(res.suggestion);
        setSource("server");
        if (res.suggestion.status === "insufficient_data") {
          showToast("Недостаточно данных на сервере — пробуем локально…");
          await requestSuggestionLocal();
        }
        return;
      }
      await requestSuggestionLocal();
    } catch {
      await requestSuggestionLocal();
    } finally {
      setBusy(false);
    }
  }

  async function decide(decision: "accept" | "reject" | "manual") {
    if (!suggestionId || !suggestion) return;
    const changeText =
      suggestion.proposedChanges
        .map((c) => `${c.exercise}: ${c.fromLoad}→${c.toLoad} ${c.unit}`)
        .join("; ") || "без изменения нагрузки";

    setBusy(true);
    try {
      if (source === "server") {
        const initData = getTelegramInitData();
        if (initData) {
          const { decideProgressionFn } = await import("@/lib/progression/server");
          const res = await decideProgressionFn({
            data: {
              initData,
              suggestionId,
              decision,
              note: note.trim() || undefined,
              manualChange: decision === "manual" ? { note: note.trim() } : undefined,
            },
          });
          if (res.ok) {
            pushClientDecision(decision, changeText);
            showToast(
              decision === "accept"
                ? "Принято. Клиент увидит решение."
                : decision === "reject"
                  ? "План без изменений."
                  : "Ручное решение зафиксировано.",
            );
            setSuggestion(null);
            setSuggestionId(null);
            return;
          }
        }
      }
      // Local / server failed — still record trainer decision for client
      pushClientDecision(decision, changeText);
      showToast(
        decision === "accept"
          ? "Принято локально. Клиент увидит решение."
          : decision === "reject"
            ? "Оставлено без изменений."
            : "Ручное решение записано.",
      );
      setSuggestion(null);
      setSuggestionId(null);
    } catch {
      pushClientDecision(decision, changeText);
      showToast("Решение записано на устройстве.");
      setSuggestion(null);
      setSuggestionId(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Surface>
      <SectionLabel>Прогрессия · решение тренера</SectionLabel>
      <p className="mt-2 text-xs text-muted-foreground">
        Предложение только по зафиксированным результатам. Без вашего решения план не меняется.
        {source === "local" ? " · данные с устройства" : source === "server" ? " · сервер" : ""}
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void requestSuggestion()}
        className="pressable mt-3 h-11 w-full rounded-xl bg-secondary text-sm font-medium"
      >
        {busy ? "Считаем…" : "Предложить следующий шаг"}
      </button>

      {suggestion ? (
        <div className="mt-3 space-y-2 rounded-xl bg-secondary/50 p-3">
          <p className="text-sm leading-relaxed">{suggestion.explanation}</p>
          {suggestion.proposedChanges.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {suggestion.proposedChanges.map((c) => (
                <li key={c.exercise} className="tabular-nums">
                  <span className="font-medium">{c.exercise}</span>: {c.fromLoad} → {c.toLoad} {c.unit}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-tiny text-muted-foreground">Изменений нагрузки нет.</p>
          )}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Комментарий (необязательно)"
            rows={2}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            <button
              type="button"
              disabled={busy || suggestion.status === "insufficient_data"}
              onClick={() => void decide("accept")}
              className="pressable h-10 rounded-lg bg-ok text-xs font-medium text-ok-foreground disabled:opacity-40"
            >
              Принять
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void decide("reject")}
              className="pressable h-10 rounded-lg bg-secondary text-xs font-medium"
            >
              Оставить
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void decide("manual")}
              className="pressable h-10 rounded-lg bg-secondary text-xs font-medium"
            >
              Вручную
            </button>
          </div>
        </div>
      ) : null}
    </Surface>
  );
}
