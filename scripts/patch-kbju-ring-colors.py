from pathlib import Path
p = Path("src/components/app/bits.tsx")
t = p.read_text()
if "// In progress → primary" in t:
    print("already")
    raise SystemExit(0)
old = '''  const r = 18;
  const c = 2 * Math.PI * r;
  const stroke = over ? "var(--color-primary)" : ratio >= 0.92 ? "var(--color-ok)" : "var(--color-primary)";

  return (
    <button
      type="button"
      className="pressable flex flex-col items-center gap-1 rounded-xl px-1 py-1"
      aria-label={`${label}: ${Math.round(safeCurrent)}${safeTarget > 0 ? ` из ${Math.round(safeTarget)}` : ""}`}
    >
      <div className="relative size-[3.25rem]">
        <svg viewBox="0 0 44 44" className="size-full -rotate-90" aria-hidden>
          <circle cx="22" cy="22" r={r} fill="none" stroke="var(--color-border)" strokeWidth="3.5" />
          <circle
            cx="22"
            cy="22"
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth="3.5"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - ratio)}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.32, 0.72, 0, 1), stroke 300ms ease" }}
          />
        </svg>
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="font-display text-sm tabular-nums leading-none text-foreground">{shown}</span>
        </span>
      </div>'''
new = '''  const r = 18;
  const c = 2 * Math.PI * r;
  // In progress → primary (red); full (≥100%) → ok (cyan); over → primary alert
  const complete = safeTarget > 0 ? ratio >= 1 : safeCurrent > 0 && ratio >= 1;
  const stroke = over
    ? "var(--color-primary)"
    : complete
      ? "var(--color-ok)"
      : "var(--color-primary)";
  const glow = over
    ? "0 0 14px rgb(221 51 42 / 0.4)"
    : complete
      ? "0 0 14px rgb(69 212 228 / 0.4)"
      : ratio > 0
        ? "0 0 10px rgb(221 51 42 / 0.22)"
        : "none";

  return (
    <button
      type="button"
      className="pressable flex flex-col items-center gap-1 rounded-xl px-1 py-1"
      aria-label={`${label}: ${Math.round(safeCurrent)}${safeTarget > 0 ? ` из ${Math.round(safeTarget)}` : ""}`}
    >
      <div className="relative size-[3.25rem]">
        <svg viewBox="0 0 44 44" className="size-full -rotate-90" aria-hidden>
          <circle cx="22" cy="22" r={r} fill="none" stroke="var(--color-border)" strokeWidth="3.5" />
          <circle
            cx="22"
            cy="22"
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth="3.5"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - ratio)}
            strokeLinecap="round"
            style={{
              transition: "stroke-dashoffset 700ms cubic-bezier(0.32, 0.72, 0, 1), stroke 350ms ease, filter 350ms ease",
              filter: glow !== "none" ? `drop-shadow(${glow})` : undefined,
            }}
          />
        </svg>
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <span
            className={cn(
              "font-display text-sm tabular-nums leading-none",
              complete && !over ? "text-ok" : over ? "text-primary" : "text-foreground",
            )}
          >
            {shown}
          </span>
        </span>
      </div>'''
if old not in t:
    raise SystemExit("pattern missing")
p.write_text(t.replace(old, new, 1))
print("ok")
