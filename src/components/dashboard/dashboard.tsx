import { useEffect, useMemo, useState } from "react";
import { BreakdownTable } from "@/components/dashboard/breakdown";
import { DashboardCharts } from "@/components/dashboard/charts";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import {
  clampRange,
  computeKpis,
  computeSeries,
  DEFAULT_RANGE,
  previousRange,
  sparklineValues,
  type DateRange,
} from "@/lib/metrics";
import { formatDateShort } from "@/lib/format";

const STORAGE_KEY = "meridian:range";

function loadRange(): DateRange {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_RANGE;
    const parsed = JSON.parse(raw) as { from?: string; to?: string };
    if (!parsed.from || !parsed.to) return DEFAULT_RANGE;
    return clampRange({
      from: new Date(parsed.from),
      to: new Date(parsed.to),
    });
  } catch {
    return DEFAULT_RANGE;
  }
}

export function Dashboard() {
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [pinned, setPinned] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    setRange(loadRange());
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      }),
    );
  }, [range]);

  const kpis = useMemo(() => computeKpis(range), [range]);
  const series = useMemo(() => computeSeries(range), [range]);
  const sparks = useMemo(
    () => ({
      revenue: sparklineValues(range, "revenue"),
      growth: sparklineValues(range, "revenue"),
      churn: sparklineValues(range, "churnRate"),
    }),
    [range],
  );
  const prev = previousRange(range);
  const highlight = hovered ?? pinned;

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <h1 className="font-display text-3xl leading-none font-medium tracking-tight">
                Meridian
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">Панель доходов</p>
            </div>
          </div>
          <p className="mt-4 max-w-xl text-sm text-muted-foreground">
            Сравнение с {formatDateShort(prev.from).replace(/\.$/, "")} —{" "}
            {formatDateShort(prev.to).replace(/\.$/, "")}. Данные демо-набора,
            считаются в браузере и доступны без сети.
          </p>
        </div>
        <DateRangePicker
          value={range}
          onChange={(next) => {
            setRange(clampRange(next));
            setPinned(null);
            setHovered(null);
          }}
        />
      </header>

      <KpiCards kpis={kpis} sparks={sparks} />

      <DashboardCharts
        points={series.points}
        grain={series.grain}
        highlight={highlight}
      />

      <BreakdownTable
        range={range}
        highlight={highlight}
        onHighlight={setHovered}
        onPin={setPinned}
        pinned={pinned}
      />
    </div>
  );
}

function Logo() {
  return (
    <span
      aria-hidden
      className="grid size-11 place-items-center rounded-2xl bg-secondary shadow-border"
    >
      <svg viewBox="0 0 32 32" className="size-6 text-primary">
        <circle
          cx="16"
          cy="16"
          r="9.25"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <ellipse
          cx="16"
          cy="16"
          rx="4.1"
          ry="9.25"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path d="M6.8 16h18.4" stroke="currentColor" strokeWidth="1.4" fill="none" />
      </svg>
    </span>
  );
}
