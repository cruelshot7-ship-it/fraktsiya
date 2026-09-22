import { useState } from "react";
import { useStudio } from "@/lib/studio-store";
import { sendTrainerNoteFn } from "@/lib/studio-sync";
import { getTelegramInitData, openTrainerChat } from "@/lib/telegram";

export function TrainerNote() {
  const open = useStudio((s) => s.noteOpen);
  const closeNote = useStudio((s) => s.closeNote);
  const showToast = useStudio((s) => s.showToast);
  const trainerUsername = useStudio((s) => s.trainerUsername);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/50 p-4" onClick={closeNote}>
      <div
        className="w-full max-w-app rounded-2xl bg-card p-4 shadow-border"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-display text-lg">Сообщение тренеру</p>
        <p className="mt-1 text-tiny text-muted-foreground">Придёт Евгению в бот. Можно и в личку.</p>
        <textarea
          className="mt-3 min-h-28 w-full rounded-lg border border-border bg-secondary px-3 py-3 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Напишите, что нужно"
          maxLength={1000}
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" className="h-11 rounded-xl bg-secondary text-sm" onClick={closeNote}>
            Закрыть
          </button>
          <button
            type="button"
            disabled={busy}
            className="pressable h-11 rounded-xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
            onClick={async () => {
              const body = text.trim();
              if (!body) {
                showToast("Напишите текст.");
                return;
              }
              setBusy(true);
              const res = await sendTrainerNoteFn({ data: { initData: getTelegramInitData(), text: body } }).catch(
                () => ({ ok: false }),
              );
              setBusy(false);
              if (res.ok) {
                setText("");
                closeNote();
                showToast("Отправлено тренеру.");
                return;
              }
              if (openTrainerChat(trainerUsername)) {
                showToast("Откройте чат и отправьте сами.");
                return;
              }
              showToast("Не отправилось. Напишите в личку бота.");
            }}
          >
            {busy ? "…" : "Отправить"}
          </button>
        </div>
        {trainerUsername ? (
          <button
            type="button"
            className="mt-2 h-10 w-full text-tiny text-muted-foreground"
            onClick={() => openTrainerChat(trainerUsername)}
          >
            Открыть личку @{trainerUsername}
          </button>
        ) : null}
      </div>
    </div>
  );
}
