import { useEffect, useRef, useState } from "react";
import { BottomSheet, SectionLabel } from "@/components/app/bits";
import { openClientNoticeFn, type OpenNoticeResult } from "@/lib/client-notices";
import { parseNoticeParam } from "@/lib/notice-rules";
import { getStartParam, getTelegramInitData } from "@/lib/telegram";

const REASON: Record<Exclude<OpenNoticeResult, { ok: true; body: string }>["reason"], string> = {
  opened: "Это сообщение уже открывали. Оно показывается один раз.",
  expired: "Срок показа этого сообщения истёк.",
  missing: "Сообщение не найдено.",
  "not-allowed": "Нет доступа.",
};

/**
 * Одноразовое уведомление: открывается по кнопке из чата (параметр запуска n_<id>).
 * Запрос уходит один раз. Отмену эффекта не используем: иначе при повторном монтировании текст выдан, но не показан.
 */
export function ClientNoticeSheet() {
  const [body, setBody] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return;
    const id = parseNoticeParam(getStartParam());
    if (id === null) return;
    requested.current = true;
    void (async () => {
      try {
        const res = await openClientNoticeFn({ data: { initData: getTelegramInitData(), id } });
        if (res.ok) setBody(res.body);
        else setMessage(REASON[res.reason]);
      } catch {
        setMessage("Нет связи. Попробуйте открыть сообщение позже.");
      }
    })();
  }, []);

  if (body === null && message === null) return null;

  return (
    <BottomSheet
      onClose={() => {
        setBody(null);
        setMessage(null);
      }}
    >
      <div className="flex flex-col gap-4 overflow-y-auto p-5">
        <SectionLabel>{body !== null ? "Сообщение от тренера" : "Сообщение"}</SectionLabel>
        {body !== null ? (
          <>
            <p className="whitespace-pre-line break-words text-sm leading-relaxed">{body}</p>
            <p className="text-tiny text-muted-foreground">
              Сообщение показано один раз. Оно удалено из чата и с сервера, повторно его не открыть.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}
        <button
          type="button"
          onClick={() => {
            setBody(null);
            setMessage(null);
          }}
          className="pressable h-11 rounded-lg bg-secondary text-sm font-medium"
        >
          Понятно
        </button>
      </div>
    </BottomSheet>
  );
}
