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
