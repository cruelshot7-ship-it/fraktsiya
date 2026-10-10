import { useState } from "react";
import { PRIVACY_VERSION } from "@/lib/privacy";
import { POLICY_SECTIONS } from "@/lib/privacy-text";
import { useStudio, activeClient } from "@/lib/studio-store";
import { SectionLabel, Surface } from "@/components/app/bits";

function PolicyText() {
  return (
    <div className="flex flex-col gap-4">
      {POLICY_SECTIONS.map((section) => (
        <div key={section.title}>
          <SectionLabel>{section.title}</SectionLabel>
          <div className="mt-2 flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
            {section.body.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">Версия политики: {PRIVACY_VERSION}</p>
    </div>
  );
}

/** Shown instead of the app until the client accepts the current policy version. */
export function PrivacyGate() {
  const acceptPrivacy = useStudio((s) => s.acceptPrivacy);
  const declinePrivacy = useStudio((s) => s.declinePrivacy);
  const showToast = useStudio((s) => s.showToast);
  const [declined, setDeclined] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <Surface>
        <p className="text-sm">
          Перед работой в приложении прочитайте, какие данные мы собираем и зачем. Без согласия приложение не будет
          вести ваши данные.
        </p>
      </Surface>
      <PolicyText />
      {declined ? (
        <Surface>
          <p className="text-sm text-muted-foreground">
            Без согласия мы не можем вести программу и записи. Закройте приложение, если не согласны. Передумаете,
            откройте его снова.
          </p>
        </Surface>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="pressable h-12 rounded-xl bg-secondary text-sm"
            onClick={() => {
              declinePrivacy();
              setDeclined(true);
            }}
          >
            Не согласен
          </button>
          <button
            type="button"
            className="pressable h-12 rounded-xl bg-primary text-sm font-medium text-primary-foreground"
            onClick={() => {
              acceptPrivacy();
              showToast("Спасибо, согласие сохранено.");
            }}
          >
            Согласен
          </button>
        </div>
      )}
    </div>
  );
}

/** "Ещё → Мои данные": the policy, the consent date, and erasure with a second confirmation. */
export function MyDataPanel() {
  const clients = useStudio((s) => s.clients);
  const activeClientId = useStudio((s) => s.activeClientId);
  const eraseMyData = useStudio((s) => s.eraseMyData);
  const client = activeClient({ clients, activeClientId });
  const [confirming, setConfirming] = useState(false);
  const acceptedAt = client?.consent?.acceptedAt;
  return (
    <div className="flex flex-col gap-4">
      <Surface>
        <SectionLabel>Ваше согласие</SectionLabel>
        <p className="mt-2 text-sm text-muted-foreground">
          {acceptedAt
            ? `Согласие от ${new Date(acceptedAt).toLocaleDateString("ru-RU")}, версия ${PRIVACY_VERSION}.`
            : "Согласие ещё не записано."}
        </p>
      </Surface>
      <Surface>
        <SectionLabel>Удалить мои данные</SectionLabel>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Стираются имя, контакты, замеры, питание, тренировки и вес. Записи о занятиях остаются без имени. Отменить
          нельзя.
        </p>
        {confirming ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" className="pressable h-11 rounded-lg bg-secondary text-sm" onClick={() => setConfirming(false)}>
              Отмена
            </button>
            <button
              type="button"
              className="pressable h-11 rounded-lg bg-destructive text-sm font-medium text-white"
              onClick={() => {
                eraseMyData();
                setConfirming(false);
              }}
            >
              Да, удалить
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="pressable mt-3 h-11 w-full rounded-lg border border-border text-sm"
            onClick={() => setConfirming(true)}
          >
            Удалить мои данные
          </button>
        )}
      </Surface>
      <PolicyText />
    </div>
  );
}
