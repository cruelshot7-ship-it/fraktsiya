import { useState } from "react";
import { getTelegramInitData } from "@/lib/telegram";
import { useStudio } from "@/lib/studio-store";
import { Surface, SectionLabel } from "@/components/app/bits";
import type { ProgressionSuggestion } from "@/lib/progression/engine";

type Props = {
  clientId: string;
  coachId: string;
  programId?: string;
};

/** Trainer-only: request explainable progression suggestion and accept / reject / manual. */
export function ProgressionPanel({ clientId, coachId, programId }: Props) {
  const showToast = useStudio((s) => s.showToast);
  const role = useStudio((s) => s.role);
  const notices = useStudio((s) => s.notices);
  const setNotices = (next: typeof notices) => useStudio.setState({ notices: next });
  const [busy, setBusy] = useState(false);
  const [suggestionId, setSuggestionId] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<ProgressionSuggestion | null>(null);
  const [note, setNote] = useState("");

  if (role !== "trainer") return null;

  const pid = programId || `prog_${coachId}_${clientId}`;

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
      if (!res.ok) {
        showToast(res.reason === "forbidden" ? "Нет доступа." : "Не удалось посчитать предложение.");
        return;
      }
      setSuggestionId(res.suggestionId);
      setSuggestion(res.suggestion);
      if (res.suggestion.status === "insufficient_data") {
        showToast("Недостаточно данных для автоматического шага.");
      }
    } catch {
      showToast("Ошибка сети. Повторите.");
    } finally {
      setBusy(false);
    }
  }

  async function decide(decision: "accept" | "reject" | "manual") {
    if (!suggestionId) return;
    const initData = getTelegramInitData();
    if (!initData) {
      showToast("Откройте из Telegram.");
      return;
    }
    setBusy(true);
    try {
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
      if (!res.ok) {
        showToast(
          res.reason === "already-resolved"
            ? "Решение уже принято."
            : res.reason === "forbidden"
              ? "Нет доступа."
              : "Не удалось сохранить решение.",
        );
        return;
      }
      const title =
        decision === "accept"
          ? "Программа обновлена"
          : decision === "reject"
            ? "План без изменений"
            : "План скорректирован вручную";
      const body =
        decision === "accept"
          ? "Тренер принял предложение по нагрузке."
          : decision === "reject"
            ? "Тренер оставил прежние рабочие веса."
            : note.trim() || "Тренер внёс ручную правку.";
      showToast(
        decision === "accept"
          ? "Предложение принято."
          : decision === "reject"
            ? "Оставлен прежний план."
            : "Зафиксирована ручная правка.",
      );
      const n = {
        id: `nt_prog_${suggestionId}_${Date.now()}`,
        audience: "client" as const,
        clientId,
        kind: "reschedule" as const,
        title,
        body,
        at: new Date().toISOString(),
      };
      setNotices([n, ...notices].slice(0, 40));
      setSuggestionId(null);
      setSuggestion(null);
      setNote("");
    } catch {
      showToast("Ошибка сети. Повторите.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Surface>
      <SectionLabel>Прогрессия · решение тренера</SectionLabel>
      <p className="mt-2 text-xs text-muted-foreground">
        Система предлагает шаг нагрузки только по зафиксированным результатам. Без вашего решения план не
        меняется.
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
