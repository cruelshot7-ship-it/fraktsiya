import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { inviteUrl } from "@/lib/telegram";
import { useStudio } from "@/lib/studio-store";
import { TRAINER_TG_ID } from "@/data/studio";
import { SectionLabel, Surface } from "@/components/app/bits";

/** Personal trainer link + QR (startapp deep link). */
export function TrainerShareCard() {
  const role = useStudio((s) => s.role);
  const showToast = useStudio((s) => s.showToast);
  const [copied, setCopied] = useState(false);

  const code = useMemo(() => `coach_${TRAINER_TG_ID}`, []);
  const link = useMemo(() => inviteUrl(undefined, code), [code]);
  // The QR is drawn in the browser: the link is not sent to any third-party service.
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(link, { width: 160, margin: 1 })
      .then((url) => {
        if (alive) setQrSrc(url);
      })
      .catch(() => {
        if (alive) setQrSrc(null);
      });
    return () => {
      alive = false;
    };
  }, [link]);

  if (role !== "trainer") return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      showToast("Ссылка скопирована.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Скопируйте ссылку вручную.");
    }
  }

  return (
    <Surface>
      <SectionLabel>Ваша ссылка и QR</SectionLabel>
      <p className="mt-2 text-tiny text-muted-foreground">
        Клиент откроет Mini App с вашим кодом. Бот должен быть тем же, что в BotFather.
      </p>
      <div className="mt-3 flex flex-col items-center gap-3">
        {qrSrc ? (
          <img src={qrSrc} alt="QR на профиль тренера" width={160} height={160} className="rounded-xl bg-white p-2" />
        ) : (
          <div aria-hidden="true" className="size-[160px] rounded-xl bg-secondary" />
        )}
        <p className="break-all text-center text-2xs text-muted-foreground">{link}</p>
        <button
          type="button"
          className="pressable h-11 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground"
          onClick={() => void copy()}
        >
          {copied ? "Скопировано" : "Копировать ссылку"}
        </button>
      </div>
    </Surface>
  );
}
