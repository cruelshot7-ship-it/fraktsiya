import { MeasuresSummary } from "@/components/app/measures-card";
import { useState, type ReactNode } from "react";
import {
  DOW,
  isoDate,
  SAMPLE_KBJU_REST,
  SAMPLE_KBJU_TRAIN,
  WEEKDAY_TIMES,
  type Client,
  type Kbju,
  type ProgramSession,
  buildProgram,
  PROGRAM_PRESETS,
  type ProgramPreset,
  type BuildGoal,
} from "@/data/studio";
import { Field, inputClass, ProgressRail, SectionLabel, Surface } from "@/components/app/bits";
import { cn } from "@/lib/utils";
import { addExerciseName } from "@/lib/exercises";

export function Kpi({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone?: "ok" | "alert";
}) {
  return (
    <div>
      <p
        className={cn(
          "font-display text-3xl leading-none tabular-nums",
          tone === "ok" && "text-ok",
          tone === "alert" && "text-primary",
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 whitespace-pre-line text-2xs leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}

export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "pressable h-8 rounded-full px-3 text-tiny font-medium",
        active ? "bg-foreground text-background" : "bg-secondary text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function MacroMini({ label, now, max }: { label: string; now: number; max: number }) {
  return (
    <div>
      <p className="text-sm tabular-nums">
        {now} / {max} г
      </p>
      <p className="text-2xs text-muted-foreground">{label}</p>
      <div className="mt-1.5">
        <ProgressRail value={now} max={max} />
      </div>
    </div>
  );
}

export function ProgramEditor({
  client,
  onBack,
  onSave,
}: {
  client: Client;
  onBack: () => void;
  onSave: (patch: Partial<Client>) => void;
}) {
  const [draft, setDraft] = useState(client);
  const [newExercise, setNewExercise] = useState("");
  const [exerciseError, setExerciseError] = useState<string | null>(null);
  const [goal, setGoal] = useState<BuildGoal>("shape");
  const [preset, setPreset] = useState<ProgramPreset>("beginner");
  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={onBack} className="pressable self-start min-h-11 text-sm text-muted-foreground">
        Назад
      </button>
      <Field label="Название программы">
        <input className={inputClass} value={draft.programTitle} onChange={(e) => setDraft({ ...draft, programTitle: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Недель">
          <input
            className={inputClass}
            inputMode="numeric"
            value={draft.programWeeks}
            onChange={(e) => setDraft({ ...draft, programWeeks: Number(e.target.value) || 1 })}
          />
        </Field>
        <Field label="Старт">
          <input className={inputClass} type="date" value={draft.programStart} onChange={(e) => setDraft({ ...draft, programStart: e.target.value })} />
        </Field>
      </div>
      <SectionLabel>Дни визита</SectionLabel>
      <div className="flex flex-wrap gap-1">
        {DOW.map((label, i) => {
          const on = draft.trainDays.includes(i);
          return (
            <button
              key={label}
              type="button"
              onClick={() => {
                const trainDays = on
                  ? draft.trainDays.filter((d) => d !== i)
                  : [...draft.trainDays, i].sort((a, b) => a - b);
                setDraft({ ...draft, trainDays });
              }}
              className={cn(
                "pressable h-9 min-w-10 rounded-lg px-2 text-xs",
                on ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      <p className="text-tiny text-muted-foreground">Порядок блоков сверху вниз — это порядок визитов. Буквы в названии дня ни на что не влияют.</p>
      <SectionLabel>Свои упражнения для рекордов</SectionLabel>
      <p className="text-tiny text-muted-foreground">Базовые пять есть всегда. Добавьте свои, например «ягодичный мост» — клиент сможет записывать по ним подходы.</p>
      <div className="flex flex-wrap gap-1">
        {(draft.exerciseNames ?? []).map((name) => (
          <span key={name} className="flex h-9 items-center gap-1 rounded-full bg-secondary pl-3 pr-1 text-sm">
            {name}
            <button
              type="button"
              aria-label={`Убрать ${name}`}
              className="pressable grid size-7 place-items-center rounded-full text-muted-foreground"
              onClick={() => setDraft({ ...draft, exerciseNames: (draft.exerciseNames ?? []).filter((x) => x !== name) })}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className={inputClass}
          placeholder="Например, ягодичный мост"
          value={newExercise}
          onChange={(e) => {
            setNewExercise(e.target.value);
            setExerciseError(null);
          }}
        />
        <button
          type="button"
          className="pressable h-11 shrink-0 rounded-lg bg-secondary px-4 text-sm"
          onClick={() => {
            const res = addExerciseName(draft.exerciseNames ?? [], newExercise);
            if (!res.ok) {
              setExerciseError(res.reason);
              return;
            }
            setDraft({ ...draft, exerciseNames: res.list });
            setNewExercise("");
          }}
        >
          Добавить
        </button>
      </div>
      {exerciseError ? <p className="text-tiny text-destructive">{exerciseError}</p> : null}
      <SectionLabel>Сплит · шаблон</SectionLabel>
      <div className="grid grid-cols-1 gap-1.5">
        {PROGRAM_PRESETS.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => setPreset(row.id)}
            className={cn(
              "pressable rounded-xl px-3 py-2.5 text-left",
              preset === row.id ? "bg-primary text-primary-foreground" : "bg-secondary",
            )}
          >
            <span className="block text-sm font-medium">{row.label}</span>
            <span className={cn("mt-0.5 block text-2xs", preset === row.id ? "text-primary-foreground/80" : "text-muted-foreground")}>
              {row.hint}
            </span>
          </button>
        ))}
      </div>
      <SectionLabel>Цель нагрузки</SectionLabel>
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["shape", "Форма"],
            ["strength", "Сила"],
            ["cut", "Легче"],
          ] as [BuildGoal, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setGoal(id)}
            className={cn("pressable h-11 rounded-lg text-sm", goal === id ? "bg-primary text-primary-foreground" : "bg-secondary")}
          >
            {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="pressable h-11 rounded-xl bg-secondary text-sm"
        onClick={() => {
          const built = buildProgram(draft, goal, preset);
          const n = built.sessions.length;
          const defaultDays: Record<number, number[]> = {
            2: [0, 3],
            3: [0, 2, 4],
            4: [0, 1, 3, 4],
          };
          const trainDays =
            draft.trainDays.length > 0 ? draft.trainDays : (defaultDays[n] ?? [0, 2, 4]);
          setDraft({
            ...draft,
            programTitle: built.programTitle,
            sessions: built.sessions,
            trainDays,
            programStart: isoDate(new Date()),
            programWeeks: draft.programWeeks || 8,
          });
        }}
      >
        Собрать черновик
      </button>
      <p className="text-tiny text-muted-foreground">
        {draft.weight > 0
          ? `Вес ${draft.weight} кг. Веса стартовые — поправь под технику.`
          : "Веса нет — кг не ставлю."}{" "}
        Сплит из {draft.sessions.length || "—"} блоков · дни:{" "}
        {draft.trainDays.length
          ? draft.trainDays.map((d) => DOW[d]).join(", ")
          : "выберутся при сборке"}
        . Старт цикла — сегодня (сброс при «Собрать»).
      </p>
      <SectionLabel>Время</SectionLabel>
      <div className="flex flex-wrap gap-1">
        {WEEKDAY_TIMES.map((t) => {
          const on = draft.trainTimes.includes(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => {
                const trainTimes = on ? draft.trainTimes.filter((x) => x !== t) : [...draft.trainTimes, t];
                setDraft({ ...draft, trainTimes });
              }}
              className={cn(
                "pressable h-9 rounded-lg px-2 text-xs",
                on ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
              )}
            >
              {t}
            </button>
          );
        })}
      </div>
      {draft.sessions.map((session, idx) => (
        <SessionEditor
          key={session.id}
          session={session}
          index={idx}
          onChange={(next) => setDraft({ ...draft, sessions: draft.sessions.map((s) => (s.id === session.id ? next : s)) })}
          onRemove={() => {
            if (draft.sessions.length === 1) return;
            setDraft({ ...draft, sessions: draft.sessions.filter((s) => s.id !== session.id) });
          }}
        />
      ))}
      <button
        type="button"
        className="h-10 rounded-lg border border-hairline text-xs text-muted-foreground"
        onClick={() => {
          const n = draft.sessions.length + 1;
          const session: ProgramSession = {
            id: `s_${Date.now()}`,
            name: `День ${String.fromCharCode(64 + n)}`,
            focus: "Фокус",
            items: ["Упражнение 3×8"],
          };
          setDraft({ ...draft, sessions: [...draft.sessions, session] });
        }}
      >
        Добавить день программы
      </button>
      <button
        type="button"
        className="pressable h-12 rounded-xl bg-primary text-sm font-medium text-primary-foreground"
        onClick={() =>
          onSave({
            programTitle: draft.programTitle,
            programWeeks: draft.programWeeks,
            programStart: draft.programStart,
            trainDays: draft.trainDays,
            trainTimes: draft.trainTimes,
            sessions: draft.sessions,
            exerciseNames: draft.exerciseNames ?? [],
          })
        }
      >
        Сохранить программу
      </button>
    </div>
  );
}

function SessionEditor({
  session,
  index,
  onChange,
  onRemove,
}: {
  session: ProgramSession;
  index: number;
  onChange: (s: ProgramSession) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl bg-secondary/60 p-3 shadow-border">
      <div className="flex items-center justify-between gap-2">
        <p className="text-2xs text-muted-foreground">Визит {index + 1} на неделе</p>
        <button type="button" onClick={onRemove} className="text-2xs text-muted-foreground">
          убрать
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <input className={inputClass} value={session.name} onChange={(e) => onChange({ ...session, name: e.target.value })} />
        <input className={inputClass} value={session.focus} onChange={(e) => onChange({ ...session, focus: e.target.value })} />
      </div>
      <textarea
        className={`${inputClass} mt-2 h-36 resize-none py-2`}
        placeholder={"1. Тяга верхнего блока\n3×8-10\n60-70 кг\nОтдых 90 секунд"}
        value={session.items.join("\n")}
        onChange={(e) =>
          onChange({ ...session, items: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) })
        }
      />
      <p className="mt-2 text-tiny leading-relaxed text-muted-foreground">
        Одна строка — один пункт. Название, затем подходы, вес и отдых. «кг» и слово «Отдых» обязательны. «на каждую руку» считает две стороны.
      </p>
    </div>
  );
}

export function FoodEditor({
  client,
  onBack,
  onSave,
}: {
  client: Client;
  onBack: () => void;
  onSave: (patch: { kbju: Kbju; kbjuRest: Kbju }) => void;
}) {
  const [train, setTrain] = useState(client.kbju.calories ? client.kbju : SAMPLE_KBJU_TRAIN);
  const [rest, setRest] = useState(client.kbjuRest?.calories ? client.kbjuRest : SAMPLE_KBJU_REST);
  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={onBack} className="pressable self-start min-h-11 text-sm text-muted-foreground">
        Назад
      </button>
      <SectionLabel>Тренировочный день</SectionLabel>
      <KbjuFields value={train} onChange={setTrain} />
      <SectionLabel>День отдыха</SectionLabel>
      <KbjuFields value={rest} onChange={setRest} />
      <p className="text-tiny text-muted-foreground">Клиент видит тренировочные цифры в дни записи или своих train days, иначе — день отдыха.</p>
      <button
        type="button"
        className="pressable h-12 rounded-xl bg-primary text-sm font-medium text-primary-foreground"
        onClick={() => onSave({ kbju: train, kbjuRest: rest })}
      >
        Сохранить питание
      </button>
    </div>
  );
}

function KbjuFields({ value, onChange }: { value: Kbju; onChange: (k: Kbju) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(
        [
          ["calories", "ккал"],
          ["protein", "белки, г"],
          ["fat", "жиры, г"],
          ["carbs", "углеводы, г"],
        ] as const
      ).map(([key, label]) => (
        <Field key={key} label={label}>
          <input
            className={inputClass}
            inputMode="numeric"
            value={value[key]}
            onChange={(e) => onChange({ ...value, [key]: Number(e.target.value) || 0 })}
          />
        </Field>
      ))}
    </div>
  );
}

export function MeasuresEditor({
  client,
  onBack,
  onSave,
  onRemove,
}: {
  client: Client;
  onBack: () => void;
  onSave: (patch: Partial<Client>) => void;
  onRemove: () => void;
}) {
  const [weight, setWeight] = useState(String(client.weight));
  const [firstName, setFirstName] = useState(client.firstName);
  const [lastName, setLastName] = useState(client.lastName);
  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={onBack} className="pressable self-start min-h-11 text-sm text-muted-foreground">
        Назад
      </button>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Имя">
          <input className={inputClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </Field>
        <Field label="Фамилия">
          <input className={inputClass} value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </Field>
      </div>
      <Field label="Вес, кг">
        <input className={inputClass} inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
      </Field>
      <Surface>
        <SectionLabel>Замеры, см</SectionLabel>
        <div className="mt-3">
          <MeasuresSummary client={client} />
        </div>
      </Surface>
      <Surface>
        <SectionLabel>Фото прогресса</SectionLabel>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Фото пока не принимаем: решим после согласия клиентов и юридического контура.
        </p>
      </Surface>
      <button
        type="button"
        className="pressable h-12 rounded-xl bg-primary text-sm font-medium text-primary-foreground"
        onClick={() => {
          const kg = Number(weight.replace(",", "."));
          const today = isoDate(new Date());
          const history = [...client.weightHistory.filter((p) => p.date !== today), { date: today, kg: kg || client.weight }];
          onSave({ firstName, lastName, weight: kg || client.weight, weightHistory: history });
        }}
      >
        Сохранить замеры
      </button>
      <button type="button" onClick={onRemove} className="h-11 text-sm text-muted-foreground">
        Удалить клиента
      </button>
    </div>
  );
}
