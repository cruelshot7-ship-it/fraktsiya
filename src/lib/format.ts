const rubFull = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

const intFmt = new Intl.NumberFormat("ru-RU");

export function formatRub(value: number): string {
  return rubFull.format(Math.round(value));
}

export function formatRubCompact(value: number): string {
  const sign = value < 0 ? "\u2212" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    return `${sign}${trimNum(abs / 1_000_000_000)} млрд ₽`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${trimNum(abs / 1_000_000)} млн ₽`;
  }
  if (abs >= 10_000) {
    return `${sign}${trimNum(abs / 1_000, 0)} тыс. ₽`;
  }
  return formatRub(value);
}

export function formatPct(ratio: number, digits = 1): string {
  const sign = ratio > 0 ? "+" : ratio < 0 ? "\u2212" : "";
  return `${sign}${trimNum(Math.abs(ratio) * 100, digits)} %`;
}

export function formatPctPlain(ratio: number, digits = 1): string {
  return `${trimNum(Math.abs(ratio) * 100, digits)} %`;
}

export function formatInt(value: number): string {
  return intFmt.format(Math.round(value));
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateShort(date: Date): string {
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

export function formatAxisDate(date: Date, grain: "day" | "week" | "month"): string {
  if (grain === "month") {
    return date.toLocaleDateString("ru-RU", { month: "short", year: "2-digit" });
  }
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function trimNum(value: number, digits = 1): string {
  const fixed = value.toFixed(digits);
  const normalized = digits === 0 ? fixed : fixed.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  return normalized.replace(".", ",");
}
