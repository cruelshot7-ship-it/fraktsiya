import { useId } from "react";
import { cn } from "@/lib/utils";

type Props = {
  values: number[];
  tone?: "neutral" | "positive" | "negative";
  className?: string;
};

export function Sparkline({ values, tone = "neutral", className }: Props) {
  const width = 112;
  const height = 36;
  const pad = 2;
  const gradientId = useId();
  if (values.length < 2) {
    return <div className={cn("h-9 w-28", className)} />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coords = values.map((value, index) => {
    const x = pad + (index / (values.length - 1)) * (width - pad * 2);
    const y = height - pad - ((value - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = coords.map(([x, y]) => `${x},${y}`).join(" ");
  const area = `${pad},${height - pad} ${line} ${width - pad},${height - pad}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn(
        "h-9 w-28",
        tone === "positive" && "text-positive",
        tone === "negative" && "text-negative",
        tone === "neutral" && "text-primary",
        className,
      )}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gradientId})`} />
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
