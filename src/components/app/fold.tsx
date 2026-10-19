import type { ReactNode } from "react";

/**
 * Вторичный блок, который открывается по запросу: заголовок с итогом виден сразу,
 * содержимое — по нажатию. Нативный details: работает без своего состояния и с клавиатуры.
 */
export function Fold({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <details className="group">
      <summary className="apple-block pressable flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 break-words">{title}</span>
        <span aria-hidden className="shrink-0 text-muted-foreground transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}
