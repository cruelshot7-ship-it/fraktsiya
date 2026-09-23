import { useEffect, useRef, useState } from "react";
import { MACHINES, type Machine, type MachineEx } from "@/data/studio";
import { SectionLabel, Surface } from "@/components/app/bits";
import { cn } from "@/lib/utils";

export function HallView() {
  const [machine, setMachine] = useState<Machine | null>(null);
  const [ex, setEx] = useState<MachineEx | null>(null);

  if (ex && machine) {
    return <Drill machine={machine} exercise={ex} onBack={() => setEx(null)} />;
  }

  if (machine) {
    return (
      <div className="stagger-in flex flex-col gap-3">
        <button type="button" onClick={() => setMachine(null)} className="self-start text-xs text-muted-foreground">
          ← сканер
        </button>
        <Surface glow="ok">
          <SectionLabel>{machine.zone}</SectionLabel>
          <h2 className="font-display mt-1 text-xl">{machine.name}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{machine.hint}</p>
        </Surface>
        {machine.exercises.map((item) => (
          <button
            key={item.name}
            type="button"
            onClick={() => setEx(item)}
            className="pressable rounded-xl bg-card px-4 py-3 text-left shadow-border"
          >
            <span className="font-display block text-base">{item.name}</span>
            <span className="mt-1 block text-xs text-muted-foreground">техника и проверка траектории</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="stagger-in flex flex-col gap-3">
      <Surface glow="soft">
        <SectionLabel>Сканер</SectionLabel>
        <h2 className="font-display mt-1 text-xl">Наведите на тренажёр</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Здесь — демо: выберите стойку, разберите технику и повторите траекторию пальцем.
        </p>
      </Surface>
      <div className="grid grid-cols-2 gap-2">
        {MACHINES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setMachine(item)}
            className="pressable rounded-xl bg-card px-3 py-3 text-left shadow-border"
          >
            <span className="text-2xs tracking-wide text-muted-foreground uppercase">{item.zone}</span>
            <span className="font-display mt-1 block text-sm">{item.name}</span>
          </button>
        ))}
      </div>
      <Surface>
        <SectionLabel>Как лучше сделать в зале</SectionLabel>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          На каждый тренажёр — QR-наклейка. Клиент сканирует из мини-приложения и сразу получает упражнения и технику. Так надёжнее, чем «голая» камера: в Telegram WebView свет, угол и похожие рамы путают модель.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Дальше: если QR нет — фото стойки на 6–12 тренажёров. Контроль формы камерой — только после того, как упражнение уже выбрано.
        </p>
      </Surface>
    </div>
  );
}

function Drill({
  machine,
  exercise,
  onBack,
}: {
  machine: Machine;
  exercise: MachineEx;
  onBack: () => void;
}) {
  const [score, setScore] = useState<number | null>(null);
  const [reps, setReps] = useState(0);

  return (
    <div className="stagger-in flex flex-col gap-3">
      <button type="button" onClick={onBack} className="self-start text-xs text-muted-foreground">
        ← {machine.name}
      </button>
      <Surface glow="ok">
        <SectionLabel>Техника</SectionLabel>
        <h2 className="font-display mt-1 text-xl">{exercise.name}</h2>
        <ul className="mt-3 space-y-1.5 text-sm">
          {exercise.cues.map((cue) => (
            <li key={cue} className="flex gap-2">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-ok" />
              <span>{cue}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-2xs tracking-wide text-muted-foreground uppercase">Частые ошибки</p>
        <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">
          {exercise.mistakes.map((m) => (
            <li key={m}>— {m}</li>
          ))}
        </ul>
      </Surface>

      <Surface className="overflow-hidden p-0" glow="alert">
        <div className="px-4 pt-4">
          <SectionLabel>Проверка траектории</SectionLabel>
          <p className="mt-1 text-xs text-muted-foreground">
            Необязательно. Три раза проведите пальцем по дуге — так запоминается путь грифа, это не зачёт подхода.
          </p>
        </div>
        <FormCanvas
          kind={exercise.path}
          onRep={(accuracy) => {
            setReps((n) => n + 1);
            setScore((prev) => (prev == null ? accuracy : Math.round((prev + accuracy) / 2)));
          }}
        />
        <div className="flex items-center justify-between px-4 pb-4">
          <p className="font-display text-2xl tabular-nums">{score == null ? "—" : `${score}%`}</p>
          <p className="text-xs text-muted-foreground">{reps}/3 повтора</p>
        </div>
      </Surface>
    </div>
  );
}

function pathFor(kind: MachineEx["path"], w: number, h: number) {
  const pts: { x: number; y: number }[] = [];
  if (kind === "row") {
    for (let i = 0; i <= 40; i += 1) {
      const t = i / 40;
      const x = w * 0.22 + Math.sin(t * Math.PI) * w * 0.52;
      const y = h * 0.55 - Math.sin(t * Math.PI) * 18;
      pts.push({ x, y });
    }
  } else {
    for (let i = 0; i <= 40; i += 1) {
      const t = i / 40;
      const y = h * 0.18 + Math.sin(t * Math.PI) * h * 0.62;
      const x = w * 0.5 + Math.sin(t * Math.PI * 2) * (kind === "squat" ? 10 : 6);
      pts.push({ x, y });
    }
  }
  return pts;
}

function FormCanvas({
  kind,
  onRep,
}: {
  kind: MachineEx["path"];
  onRep: (accuracy: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const ghost = useRef(0);
  const stroke = useRef<{ x: number; y: number }[]>([]);
  const drawing = useRef(false);
  const kindRef = useRef(kind);
  kindRef.current = kind;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      ghost.current = (ghost.current + dt * 0.55) % 1;
      draw(ctx, canvas, kindRef.current, ghost.current, stroke.current);
      raf = requestAnimationFrame(loop);
    };
    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    raf = requestAnimationFrame(loop);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const point = (e: React.PointerEvent) => {
    const canvas = ref.current;
    if (!canvas) return { x: 0, y: 0 };
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <canvas
      ref={ref}
      className={cn("mt-2 h-52 w-full touch-none bg-background")}
      onPointerDown={(e) => {
        (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
        drawing.current = true;
        stroke.current = [point(e)];
      }}
      onPointerMove={(e) => {
        if (!drawing.current) return;
        stroke.current = [...stroke.current, point(e)];
      }}
      onPointerUp={() => {
        if (!drawing.current) return;
        drawing.current = false;
        const canvas = ref.current;
        if (!canvas || stroke.current.length < 8) {
          stroke.current = [];
          return;
        }
        const path = pathFor(kind, canvas.clientWidth, canvas.clientHeight);
        const acc = scoreStroke(stroke.current, path);
        stroke.current = [];
        onRep(acc);
      }}
    />
  );
}

function draw(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  kind: MachineEx["path"],
  t: number,
  stroke: { x: number; y: number }[],
) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);
  const path = pathFor(kind, w, h);
  ctx.strokeStyle = "rgba(178,59,46,0.35)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  path.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  const g = path[Math.min(path.length - 1, Math.floor(t * path.length))];
  ctx.fillStyle = "#b23b2e";
  ctx.beginPath();
  ctx.arc(g.x, g.y, 6, 0, Math.PI * 2);
  ctx.fill();
  if (stroke.length > 1) {
    ctx.strokeStyle = "#ece7dc";
    ctx.lineWidth = 2;
    ctx.beginPath();
    stroke.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
  }
}

function scoreStroke(stroke: { x: number; y: number }[], path: { x: number; y: number }[]) {
  let err = 0;
  for (const p of stroke) {
    let best = Infinity;
    for (const q of path) {
      const d = (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
      if (d < best) best = d;
    }
    err += Math.sqrt(best);
  }
  const avg = err / stroke.length;
  return Math.max(0, Math.min(100, Math.round(100 - avg * 1.2)));
}
