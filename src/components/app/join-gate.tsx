import { useState } from "react";
import { useStudio } from "@/lib/studio-store";
import { openTrainerChat } from "@/lib/telegram";
import { Field, inputClass } from "@/components/app/bits";

export function JoinGate() {
  const trainerUsername = useStudio((s) => s.trainerUsername);
  const claimByPhone = useStudio((s) => s.claimByPhone);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="rounded-xl bg-card px-5 py-8 text-center shadow-border">
      <p className="font-display text-xl">Вас ещё нет в зале</p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Тренер уже заносит вас у себя. Если есть @username — просто закройте и откройте приложение. Иначе введите телефон.
      </p>
      <div className="mt-5 text-left">
        <Field label="Телефон">
          <input
            className={inputClass}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+7 900 000-00-00"
            inputMode="tel"
          />
        </Field>
      </div>
      <button
        type="button"
        disabled={busy}
        className="pressable mt-3 h-12 w-full rounded-xl bg-secondary text-sm font-medium"
        onClick={async () => {
          setBusy(true);
          await claimByPhone(phone);
          setBusy(false);
        }}
      >
        Это я
      </button>
      <button
        type="button"
        className="pressable mt-2 h-12 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground"
        onClick={() => openTrainerChat(trainerUsername)}
      >
        Написать тренеру
      </button>
    </div>
  );
}
