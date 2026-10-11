import { useState } from "react";
import type { Client } from "@/data/studio";
import { isoDate } from "@/data/studio";
import { confirmAction } from "@/lib/confirm";
import { parseAmount, recentPayments, type Payment } from "@/lib/payments";
import { useStudio } from "@/lib/studio-store";
import { Field, inputClass, SectionLabel, Surface } from "@/components/app/bits";

/** Оплаты клиента и цена занятия. Только для тренера; баланс занятий эта панель не меняет. */
export function PaymentPanel({ client }: { client: Client }) {
  const updateClient = useStudio((s) => s.updateClient);
  const showToast = useStudio((s) => s.showToast);
  const today = isoDate(new Date());
  const [priceText, setPriceText] = useState(client.price != null ? String(client.price) : "");
  const [amountText, setAmountText] = useState("");
  const [sessions, setSessions] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const price = client.price ?? null;
  const count = Math.max(0, Number(sessions.replace(/\D/g, "")) || 0);
  const suggested = price != null && count > 0 ? price * count : null;

  function savePrice() {
    const trimmed = priceText.trim();
    if (trimmed === "") {
      setError(null);
      updateClient(client.id, { price: null });
      return;
    }
    const next = parseAmount(trimmed);
    if (next === null) {
      setError("Цена занятия: число, например 60");
      return;
    }
    setError(null);
    updateClient(client.id, { price: next });
  }

  function record() {
    const amount = parseAmount(amountText || (suggested != null ? String(suggested) : ""));
    if (amount === null) {
      setError("Сумма: число больше нуля, например 300");
      return;
    }
    setError(null);
    const payment: Payment = {
      id: `pay_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      at: today,
      amount,
      sessions: count,
    };
    updateClient(client.id, { payments: [payment, ...(client.payments ?? [])] });
    setAmountText("");
    showToast(`Оплата записана · ${amount} BYN`);
  }

  async function remove(p: Payment) {
    if (!await confirmAction(`Удалить оплату ${p.amount} BYN от ${p.at}?`)) return;
    updateClient(client.id, { payments: (client.payments ?? []).filter((x) => x.id !== p.id) });
  }

  const recent = recentPayments(client.payments, 3);

  return (
    <Surface>
      <SectionLabel>Оплаты, BYN</SectionLabel>
      <p className="mt-1 text-tiny text-muted-foreground">Оплата не меняет баланс занятий: зачисляйте занятия кнопками ниже.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Field label="Цена занятия">
          <input
            className={inputClass}
            inputMode="decimal"
            placeholder="—"
            value={priceText}
            onChange={(e) => setPriceText(e.target.value)}
            onBlur={savePrice}
          />
        </Field>
        <Field label="Занятий в оплате">
          <input className={inputClass} inputMode="numeric" value={sessions} onChange={(e) => setSessions(e.target.value)} />
        </Field>
      </div>
      <div className="mt-2 flex gap-2">
        <input
          className={`${inputClass} min-w-0 flex-1`}
          inputMode="decimal"
          aria-label="Сумма оплаты"
          placeholder={suggested != null ? String(suggested) : "Сумма"}
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
        />
        <button type="button" onClick={record} className="pressable h-11 shrink-0 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
          Записать оплату
        </button>
      </div>
      {error ? <p className="mt-2 text-tiny text-alert-text">{error}</p> : null}
      {recent.length > 0 ? (
        <ul className="mt-3 divide-y divide-border">
          {recent.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="tabular-nums">
                {p.at} · <span className="font-medium">{p.amount} BYN</span>
                {p.sessions > 0 ? <span className="text-muted-foreground"> · {p.sessions} зан.</span> : null}
              </span>
              <button type="button" onClick={() => remove(p)} className="text-tiny text-muted-foreground">
                удалить
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-tiny text-muted-foreground">Оплат пока нет.</p>
      )}
    </Surface>
  );
}
