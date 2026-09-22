import { useState, type ReactNode } from "react";
import {
  DOW,
  isoDate,
  WEEKDAY_TIMES,
  type Client,
  type ProgramSession,
} from "@/data/studio";
import { Field, inputClass, SectionLabel, Surface } from "@/components/app/bits";
import { cn } from "@/lib/utils";

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
  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={onBack} className="self-start text-xs text-muted-foreground">
        ← к карточке
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
      <p className="text-tiny text-muted-foreground">Первый визит недели всегда день A — даже если это четверг.</p>
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
        className={`${inputClass} mt-2 h-24 resize-none py-2`}
        value={session.items.join("\n")}
        onChange={(e) =>
          onChange({ ...session, items: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) })
        }
      />
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
  onSave: (kbju: Client["kbju"]) => void;
}) {
  const [kbju, setKbju] = useState(client.kbju);
  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={onBack} className="self-start text-xs text-muted-foreground">
        ← к карточке
      </button>
      <SectionLabel>Цель КБЖУ</SectionLabel>
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
              value={kbju[key]}
              onChange={(e) => setKbju({ ...kbju, [key]: Number(e.target.value) || 0 })}
            />
          </Field>
        ))}
      </div>
      <button
        type="button"
        className="pressable h-12 rounded-xl bg-primary text-sm font-medium text-primary-foreground"
        onClick={() => onSave(kbju)}
      >
        Сохранить питание
      </button>
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
      <button type="button" onClick={onBack} className="self-start text-xs text-muted-foreground">
        ← к карточке
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
        <SectionLabel>Фото прогресса</SectionLabel>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Позже клиент будет присылать фото из мини-приложения. Сейчас тренер видит вес и серию отчётов.
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
