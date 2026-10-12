import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SectionLabel, Surface } from "@/components/app/bits";
import { monthLabel, monthOf, paymentRowsForMonth, revenueForMonth, shiftMonth } from "@/lib/payments";
import { isoDate, type Client } from "@/data/studio";

/** Оплаты месяца по всем клиентам. Только для тренера, только чтение. */
export function PaymentsView({
  clients,
  initialMonth,
  onBack,
}: {
  clients: Client[];
  initialMonth: string;
  onBack: () => void;
}) {
  const [ym, setYm] = useState(initialMonth);
  const rows = useMemo(() => paymentRowsForMonth(clients, ym), [clients, ym]);
  const total = useMemo(() => revenueForMonth(clients, ym), [clients, ym]);

  return (
    <div className="space-y-3">
      <button type="button" onClick={onBack} className="pressable self-start min-h-11 text-sm text-muted-foreground">
        ← Сегодня
      </button>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Предыдущий месяц"
          onClick={() => setYm((m) => shiftMonth(m, -1))}
          className="pressable grid size-11 place-items-center rounded-full bg-secondary"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="text-center">
          <SectionLabel>Оплаты · {monthLabel(ym)}</SectionLabel>
          <p className="mt-1 font-display text-2xl tabular-nums">
            {total.sum.toLocaleString("ru-RU")} <span className="text-base font-sans text-muted-foreground">BYN</span>
          </p>
          <p className="text-tiny text-muted-foreground">
            {total.count} {total.count === 1 ? "оплата" : "оплат"}
          </p>
        </div>
        <button
          type="button"
          aria-label="Следующий месяц"
          disabled={ym >= monthOf(isoDate(new Date()))}
          onClick={() => setYm((m) => shiftMonth(m, 1))}
          className="pressable grid size-11 place-items-center rounded-full bg-secondary disabled:opacity-40"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-tiny text-muted-foreground">За этот месяц оплат нет.</p>
      ) : (
        <Surface className="divide-y divide-border p-0">
          {rows.map((r) => (
            <div key={r.payment.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{r.name}</p>
                <p className="text-tiny text-muted-foreground">
                  {r.payment.at}
                  {r.payment.sessions > 0 ? ` · ${r.payment.sessions} зан.` : ""}
                </p>
              </div>
              <p className="shrink-0 font-display text-base tabular-nums">{r.payment.amount.toLocaleString("ru-RU")} BYN</p>
            </div>
          ))}
        </Surface>
      )}
    </div>
  );
}
