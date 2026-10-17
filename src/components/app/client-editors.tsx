import { confirmAction } from "@/lib/confirm";
import { MeasuresSummary } from "@/components/app/measures-card";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import {
  coachKey,
  DOW,
  isoDate,
  SAMPLE_KBJU_REST,
  SAMPLE_KBJU_TRAIN,
  type Client,
  type Kbju,
  type ProgramSession,
  buildProgram,
  PROGRAM_PRESETS,
  type ProgramPreset,
  type BuildGoal,
} from "@/data/studio";
import { Field, inputClass, ProgressRail, SectionLabel, Surface } from "@/components/app/bits";
import { WheelField } from "@/components/app/wheel-picker";
import { Fold } from "@/components/app/fold";
import { cn } from "@/lib/utils";
import { addExerciseName, exerciseOptions } from "@/lib/exercises";
import {
  blockLines,
  blockSummary,
  newBlockId,
  PHASE_LABEL,
  PHASES,
  SIDES,
  sessionPlan,
  withBlocks,
  type ProgramBlock,
} from "@/lib/program-blocks";
import { parsePastedProgram, type PastedProgram } from "@/lib/program-import";
import { templateFromSession } from "@/lib/templates/program-template";
import { useStudio } from "@/lib/studio-store";
import { specialDataAllowed } from "@/lib/privacy";

/** Числа «набегают» от прежнего значения к новому. При «уменьшении движения» сразу показывают итог. */
function useCountUp(target: number, ms = 700) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setShown(target);
      from.current = target;
      return;
    }
    const begin = from.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(begin + (target - begin) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return shown;
}

export function Kpi({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone?: "ok" | "alert";
}) {
  const shown = useCountUp(value);
  return (
    <div>
      <p
        className={cn(
          "font-display text-3xl leading-none tabular-nums",
          tone === "ok" && "text-ok",
          tone === "alert" && "text-alert-text",
        )}
      >
        {shown}
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
        "pressable inline-flex h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3.5 text-tiny font-medium",
        active ? "chip-moon" : "bg-secondary text-muted-foreground",
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
  onSave: (patch: Partial<Client>, reason?: string) => void;
}) {
  const [draft, setDraft] = useState(client);
  /** причина изменения: клиент увидит её в истории плана */
  const [reason, setReason] = useState("");
  const [newExercise, setNewExercise] = useState("");
  const [exerciseError, setExerciseError] = useState<string | null>(null);
  const [goal, setGoal] = useState<BuildGoal>("shape");
  const [preset, setPreset] = useState<ProgramPreset>("beginner");
  const [paste, setPaste] = useState("");
  const [parsed, setParsed] = useState<PastedProgram | null>(null);
  const saveTemplate = useStudio((s) => s.saveTemplate);
  const showToast = useStudio((s) => s.showToast);
  const extraSlots = useStudio((s) => s.extraSlots);
  // Времена тренировок — только те, что тренер сам добавил во вкладке «Слоты» (вшитых нет).
  const timeOptions = [...new Set([...extraSlots.map((s) => s.time), ...draft.trainTimes])].sort();
  // unsaved work: pasted text, or days/title/weeks that differ from the client's saved copy
  const dirty = paste.trim() !== "" || JSON.stringify(draft) !== JSON.stringify(client);
  const leave = async () => {
    if (dirty && !await confirmAction("Выйти без сохранения? Несохранённые правки пропадут.")) return;
    onBack();
  };
  const dayToTemplate = (session: ProgramSession) => {
    const tpl = templateFromSession(session, coachKey(client.coachId), `tpl_${Date.now().toString(36)}`);
    if (tpl.exercises.length === 0) {
      showToast("В дне нет упражнений — сохранять в шаблоны нечего.");
      return;
    }
    saveTemplate(tpl);
    showToast(`День «${tpl.title}» сохранён в шаблоны.`);
  };

  // the pasted program becomes the client's days: replaced, or added after the current ones
  const assign = async (mode: "replace" | "append") => {
    if (!parsed || !parsed.ok) return;
    const hasDays = draft.sessions.some((s) => s.items.length > 0);
    if (mode === "replace" && hasDays && !await confirmAction(`Заменить ${draft.sessions.length} дн. на ${parsed.sessions.length}? Текущие дни уйдут.`)) return;
    const sessions = mode === "replace" ? parsed.sessions : [...draft.sessions, ...parsed.sessions];
    // same stamp as the bot's import, so a stale copy read before this save cannot overwrite it
    onSave({ sessions, programAt: new Date().toISOString() });
  };

  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={leave} className="pressable self-start min-h-11 text-sm text-muted-foreground">
        Назад
      </button>
      <Fold title="Вставить программу текстом">
      <p className="text-tiny text-muted-foreground">
        Вставьте программу как есть: из заметок или чата. «День A», «День B» — заголовки дней. Под упражнением, каждое с новой строки: подходы×повторения (4×8), вес (80 кг), отдых (Отдых 90 секунд). Строка «/program» не нужна.
      </p>
      <textarea
        className="min-h-40 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
        placeholder={"День A\nЖим лежа\n4×8\n80 кг\nОтдых 90 секунд"}
        value={paste}
        onChange={(e) => {
          setPaste(e.target.value);
          setParsed(null);
        }}
      />
      <button
        type="button"
        disabled={!paste.trim()}
        className="pressable h-11 rounded-xl bg-secondary text-sm disabled:opacity-50"
        onClick={() => setParsed(parsePastedProgram(paste))}
      >
        Разобрать по дням
      </button>
      {parsed && !parsed.ok ? <p className="text-tiny text-destructive">{parsed.error}</p> : null}
      {parsed && parsed.ok ? (
        <div className="flex flex-col gap-2 rounded-xl bg-card p-3 shadow-border">
          <p className="text-sm font-medium">
            Распознано: {parsed.sessions.length} дн., {parsed.exercises} упр.
          </p>
          {parsed.sessions.map((s) => (
            <div key={s.id}>
              <p className="text-xs font-medium">
                {s.name} · {s.blocks.length} упр.
              </p>
              <ul className="mt-1 flex flex-col gap-1">
                {s.blocks.map((b) => {
                  const details = blockLines(b).slice(1).join(" · ");
                  return (
                    <li key={b.id} className="text-tiny text-muted-foreground">
                      <span className="text-foreground">{b.exercise}</span>
                      {details ? ` · ${details}` : ""}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {parsed.warnings.map((w, i) => (
            <p key={i} className="text-tiny text-alert-text">
              ⚠ {w}
            </p>
          ))}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="pressable h-11 rounded-xl bg-primary text-sm font-medium text-primary-foreground"
              onClick={() => assign("replace")}
            >
              Заменить дни
            </button>
            <button type="button" className="pressable h-11 rounded-xl bg-secondary text-sm" onClick={() => assign("append")}>
              Добавить в конец
            </button>
          </div>
          <p className="text-tiny text-muted-foreground">
            «Заменить» — текущие дни уйдут. «Добавить» — новые дни встанут после них. Сохраняется сразу, как в боте.
          </p>
        </div>
      ) : null}
      </Fold>
      <Field label="Название программы">
        <input className={inputClass} value={draft.programTitle} onChange={(e) => setDraft({ ...draft, programTitle: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Недель">
          <WheelField
            label="Недель"
            value={String(draft.programWeeks)}
            onChange={(v) => setDraft({ ...draft, programWeeks: Number(v) || 1 })}
            max={52}
            start={8}
            unit="нед."
          />
        </Field>
        <Field label="Старт">
          <input className={inputClass} type="date" value={draft.programStart} onChange={(e) => setDraft({ ...draft, programStart: e.target.value })} />
        </Field>
      </div>
      <Fold title={`Фазы по неделям · ${Object.keys(draft.programPhases ?? {}).length ? `${Object.keys(draft.programPhases ?? {}).length} нед. с фазой` : "не заданы"}`}>
      <p className="text-tiny text-muted-foreground">
        Фаза видна клиенту в шапке программы. Не отмечено — обычная неделя.
      </p>
      <div className="flex flex-col gap-1">
        {Array.from({ length: draft.programWeeks }, (_, k) => String(k + 1)).map((week) => {
          const current = draft.programPhases?.[week];
          return (
            <div key={week} className="flex flex-wrap items-center gap-1.5">
              <span className="w-12 text-tiny text-muted-foreground">нед. {week}</span>
              {PHASES.map((phase) => (
                <ChipToggle
                  key={phase}
                  on={current === phase}
                  onClick={() => {
                    const next = { ...(draft.programPhases ?? {}) };
                    if (current === phase) delete next[week];
                    else next[week] = phase;
                    setDraft({ ...draft, programPhases: next });
                  }}
                >
                  {PHASE_LABEL[phase]}
                </ChipToggle>
              ))}
            </div>
          );
        })}
      </div>
      </Fold>
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
                "pressable h-10 min-w-10 rounded-lg px-2 text-xs",
                on ? "bg-ok text-ok-foreground" : "bg-secondary text-muted-foreground",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      <p className="text-tiny text-muted-foreground">Порядок блоков сверху вниз — это порядок визитов. Буквы в названии дня ни на что не влияют.</p>
      <Fold title={`Свои упражнения для рекордов · ${(draft.exerciseNames ?? []).length}`}>
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
      </Fold>
      <Fold title="Собрать программу заново по цели">
      <SectionLabel>Сплит · шаблон</SectionLabel>
      <div className="grid grid-cols-1 gap-1.5">
        {PROGRAM_PRESETS.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => setPreset(row.id)}
            className={cn(
              "pressable rounded-xl px-3 py-2.5 text-left",
              preset === row.id ? "bg-ok text-ok-foreground" : "bg-secondary",
            )}
          >
            <span className="block text-sm font-medium">{row.label}</span>
            <span className={cn("mt-0.5 block text-2xs", preset === row.id ? "text-primary-foreground" : "text-muted-foreground")}>
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
            className={cn("pressable h-11 rounded-lg text-sm", goal === id ? "bg-ok text-ok-foreground" : "bg-secondary")}
          >
            {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="pressable h-11 rounded-xl bg-secondary text-sm"
        onClick={async () => {
          const hasDays = draft.sessions.some((s) => s.items.length > 0);
          if (hasDays && !await confirmAction("Заменить дни сборкой по цели? Правки дней, что не сохранены, пропадут.")) return;
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
      </Fold>
      <SectionLabel>Время</SectionLabel>
      <div className="flex flex-wrap gap-1">
        {timeOptions.length === 0 ? (
          <p className="text-tiny text-muted-foreground">Времени пока нет. Добавьте слоты во вкладке «Слоты».</p>
        ) : null}
        {timeOptions.map((t) => {
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
                "pressable h-10 rounded-lg px-2 text-xs",
                on ? "bg-ok text-ok-foreground" : "bg-secondary text-muted-foreground",
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
          options={exerciseOptions({ custom: draft.exerciseNames ?? [] })}
          onChange={(next) => setDraft({ ...draft, sessions: draft.sessions.map((s) => (s.id === session.id ? next : s)) })}
          onSaveTemplate={() => dayToTemplate(session)}
          onRemove={async () => {
            if (draft.sessions.length === 1) return;
            if (!await confirmAction(`Удалить день «${session.name}» вместе с упражнениями?`)) return;
            setDraft({ ...draft, sessions: draft.sessions.filter((s) => s.id !== session.id) });
          }}
        />
      ))}
      <button
        type="button"
        className="h-10 rounded-lg border border-hairline text-xs text-muted-foreground"
        onClick={() => {
          const n = draft.sessions.length + 1;
          const session: ProgramSession = withBlocks(
            {
              id: `s_${Date.now()}`,
              name: `День ${String.fromCharCode(64 + n)}`,
              focus: "Фокус",
              items: [],
            },
            [newBlock()],
          );
          setDraft({ ...draft, sessions: [...draft.sessions, session] });
        }}
      >
        Добавить день программы
      </button>
      <label className="flex flex-col gap-1">
        <span className="text-2xs text-muted-foreground">Почему меняем · клиент увидит в истории плана</span>
        <textarea
          rows={2}
          maxLength={300}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Например: добавил вес в тягу, снизил объём на третьей неделе"
          className="rounded-lg bg-secondary px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>
      <button
        type="button"
        className="pressable h-12 rounded-xl bg-primary text-sm font-medium text-primary-foreground"
        onClick={() =>
          onSave(
            {
              programTitle: draft.programTitle,
              programWeeks: draft.programWeeks,
              programStart: draft.programStart,
              trainDays: draft.trainDays,
              trainTimes: draft.trainTimes,
              sessions: draft.sessions,
              exerciseNames: draft.exerciseNames ?? [],
              programPhases: draft.programPhases ?? {},
            },
            reason.trim(),
          )
        }
      >
        Сохранить программу
      </button>
    </div>
  );
}

function newBlock(): ProgramBlock {
  return { id: newBlockId(), exercise: "Упражнение", sets: 3, reps: "8-10", load: "", rest: 90, side: null, group: null };
}

function SessionEditor({
  session,
  index,
  options,
  onChange,
  onRemove,
  onSaveTemplate,
}: {
  session: ProgramSession;
  index: number;
  options: string[];
  onChange: (s: ProgramSession) => void;
  onRemove: () => void;
  onSaveTemplate: () => void;
}) {
  const blocks = sessionPlan(session).blocks;
  const listId = `ex-${session.id}`;
  const listRef = useRef<HTMLDivElement>(null);
  /** раскрытые упражнения; свёрнутое показывает имя и одну строку параметров */
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const toggleOpen = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allOpen = blocks.length > 0 && blocks.every((b) => openIds.has(b.id));
  /** блок, который только что добавлен: фокус и прокрутка к нему, имя выделено для замены */
  const [focusBlockId, setFocusBlockId] = useState<string | null>(null);
  useEffect(() => {
    if (!focusBlockId) return;
    const card = listRef.current?.querySelector<HTMLElement>(`[data-block-id="${focusBlockId}"]`);
    const name = card?.querySelector<HTMLInputElement>("input");
    if (card && name) {
      card.scrollIntoView({ block: "center", behavior: "smooth" });
      name.focus();
      name.select();
    }
    setFocusBlockId(null);
  }, [focusBlockId, blocks]);
  /** Enter в поле блока переводит фокус на следующее поле; после «отдыха» — на имя следующего блока */
  function onBlockKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    const target = e.target as HTMLElement;
    if (target.tagName !== "INPUT") return;
    e.preventDefault();
    const card = e.currentTarget;
    const fields = Array.from(card.querySelectorAll<HTMLInputElement>("input:not([disabled])"));
    const next = fields[fields.indexOf(target as HTMLInputElement) + 1];
    if (next) {
      next.focus();
      return;
    }
    const cards = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-block-id]") ?? []);
    cards[cards.indexOf(card) + 1]?.querySelector<HTMLInputElement>("input")?.focus();
  }
  const update = (next: ProgramBlock[]) => onChange(withBlocks(session, next));
  const patch = (i: number, change: Partial<ProgramBlock>) =>
    update(blocks.map((b, j) => (j === i ? { ...b, ...change } : b)));
  const move = (i: number, to: number) => {
    const next = [...blocks];
    [next[i], next[to]] = [next[to], next[i]];
    update(next);
  };
  const toggleSuperset = (i: number) => {
    const b = blocks[i];
    const prev = blocks[i - 1];
    if (b.group && b.group === prev.group) {
      patch(i, { group: null });
      return;
    }
    const group = prev.group ?? newBlockId();
    update(blocks.map((x, j) => (j === i - 1 || j === i ? { ...x, group } : x)));
  };
  return (
    <div className="rounded-xl bg-secondary/60 p-3 shadow-border">
      <div className="flex items-center justify-between gap-2">
        <p className="text-2xs text-muted-foreground">Визит {index + 1} на неделе</p>
        <div className="flex gap-3">
          <button type="button" onClick={onSaveTemplate} className="text-2xs text-muted-foreground">
            в шаблон
          </button>
          <button type="button" onClick={onRemove} className="text-2xs text-muted-foreground">
            убрать
          </button>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <input className={inputClass} value={session.name} onChange={(e) => onChange({ ...session, name: e.target.value })} />
        <input className={inputClass} value={session.focus} onChange={(e) => onChange({ ...session, focus: e.target.value })} />
      </div>
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
      {blocks.length > 1 ? (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            className="pressable min-h-11 text-tiny text-muted-foreground"
            onClick={() => setOpenIds(allOpen ? new Set() : new Set(blocks.map((b) => b.id)))}
          >
            {allOpen ? "свернуть все" : "раскрыть все"}
          </button>
        </div>
      ) : null}
      <div ref={listRef} className="mt-2 flex flex-col gap-2">
        {blocks.map((b, i) => {
          const sameAsPrev = i > 0 && Boolean(b.group) && b.group === blocks[i - 1].group;
          const isOpen = openIds.has(b.id);
          return (
            <div
              key={b.id}
              data-block-id={b.id}
              onKeyDown={onBlockKeyDown}
              className={cn(
                "rounded-lg bg-background/40 p-2.5 transition-shadow focus-within:ring-1 focus-within:ring-ok/40",
                sameAsPrev && "border border-primary/40",
              )}
            >
              <div className="flex items-center gap-2">
                <input
                  className={cn(inputClass, "min-w-0 flex-1")}
                  list={listId}
                  enterKeyHint="next"
                  aria-label={`Упражнение ${i + 1}`}
                  value={b.exercise}
                  onChange={(e) => patch(i, { exercise: e.target.value })}
                />
                <button
                  type="button"
                  aria-label={`Удалить «${b.exercise || "упражнение"}»`}
                  onClick={async () => {
                    if (await confirmAction(`Убрать «${blocks[i].exercise || "упражнение"}» из дня?`)) update(blocks.filter((_, j) => j !== i));
                  }}
                  className="pressable grid size-11 shrink-0 place-items-center rounded-lg bg-secondary text-lg text-muted-foreground"
                >
                  ×
                </button>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-label={isOpen ? `Свернуть «${b.exercise || "упражнение"}»` : `Параметры: ${b.exercise || "упражнение"}`}
                  onClick={() => toggleOpen(b.id)}
                  className="pressable grid size-11 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground"
                >
                  <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} />
                </button>
              </div>
              {!isOpen && blockSummary(b) ? (
                <p className="mt-1.5 px-1 text-tiny tabular-nums text-muted-foreground">{blockSummary(b)}</p>
              ) : null}
              {isOpen ? (
              <>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Field label="Подходы">
                  <WheelField
                    label="Подходы"
                    value={b.sets ? String(b.sets) : ""}
                    onChange={(v) => patch(i, { sets: Number(v) || 0 })}
                    max={20}
                    start={3}
                    allowEmpty
                  />
                </Field>
                <Field label="Повторы">
                  <input className={inputClass} enterKeyHint="next" placeholder="8-10" value={b.reps} onChange={(e) => patch(i, { reps: e.target.value.trim() })} />
                </Field>
                <Field label="Вес, кг">
                  <input className={inputClass} enterKeyHint="next" placeholder="—" value={b.load} onChange={(e) => patch(i, { load: e.target.value.trim() })} />
                </Field>
                <Field label="Отдых, с">
                  <WheelField
                    label="Отдых, с"
                    value={b.rest ? String(b.rest) : ""}
                    onChange={(v) => {
                      const n = Number(v);
                      patch(i, { rest: n > 0 ? n : null });
                    }}
                    min={15}
                    max={600}
                    step={15}
                    start={90}
                    allowEmpty
                  />
                </Field>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="self-center text-tiny text-muted-foreground">на каждую:</span>
                {[null, ...SIDES].map((side) => (
                  <ChipToggle key={side ?? "none"} on={b.side === side} onClick={() => patch(i, { side })}>
                    {side ?? "нет"}
                  </ChipToggle>
                ))}
                {i > 0 ? (
                  <ChipToggle on={sameAsPrev} onClick={() => toggleSuperset(i)}>
                    суперсет
                  </ChipToggle>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="self-center text-tiny text-muted-foreground" title="Сколько повторов оставить в запасе">
                  RIR:
                </span>
                {[null, 0, 1, 2, 3, 4].map((rir) => (
                  <ChipToggle key={rir ?? "none"} on={(b.rir ?? null) === rir} onClick={() => patch(i, { rir })}>
                    {rir ?? "нет"}
                  </ChipToggle>
                ))}
              </div>
              <div className="mt-2 flex justify-end gap-1.5">
                <IconButton label="Выше" disabled={i === 0} onClick={() => move(i, i - 1)}>↑</IconButton>
                <IconButton label="Ниже" disabled={i === blocks.length - 1} onClick={() => move(i, i + 1)}>↓</IconButton>
              </div>
              </>
              ) : null}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="mt-2 h-10 w-full rounded-lg border border-hairline text-xs text-muted-foreground"
        onClick={() => {
          const created = newBlock();
          update([...blocks, created]);
          setFocusBlockId(created.id);
          setOpenIds((prev) => new Set(prev).add(created.id));
        }}
      >
        Добавить блок
      </button>
      {index === 0 ? (
      <p className="mt-2 text-tiny leading-relaxed text-muted-foreground">
        Блок — это упражнение с подходами и повторами. Вес и отдых необязательны. «на каждую руку / ногу / сторону» считает обе стороны. Суперсет — блоки подряд с отметкой.
      </p>
      ) : null}
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="pressable grid size-11 shrink-0 place-items-center rounded-lg bg-secondary text-sm text-muted-foreground disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function ChipToggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "pressable h-10 rounded-full px-3 text-tiny",
        on ? "bg-ok text-ok-foreground" : "bg-secondary text-muted-foreground",
      )}
    >
      {children}
    </button>
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
  // an empty target shows zeros, never a sample: a sample saved by accident became the client's goal
  const empty = { calories: 0, protein: 0, fat: 0, carbs: 0 };
  const [train, setTrain] = useState(client.kbju.calories ? client.kbju : empty);
  const [rest, setRest] = useState(client.kbjuRest?.calories ? client.kbjuRest : empty);
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
          <WheelField
            label={label}
            value={value[key] ? String(value[key]) : ""}
            onChange={(v) => onChange({ ...value, [key]: Number(v) || 0 })}
            max={key === "calories" ? 5000 : 500}
            step={key === "calories" ? 10 : 1}
            start={key === "calories" ? 2000 : key === "protein" ? 150 : key === "fat" ? 70 : 200}
            allowEmpty
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
  // вес — данные о здоровье: без согласия клиента тренер его не вводит и не отправляет
  const healthOk = specialDataAllowed(client.consent);
  const [firstName, setFirstName] = useState(client.firstName);
  const [askRemove, setAskRemove] = useState(false);
  const [typed, setTyped] = useState("");
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
      {healthOk ? (
        <Field label="Вес, кг">
          <WheelField
            label="Вес, кг"
            kind="dec"
            unit="кг"
            min={30}
            max={300}
            start={70}
            value={weight}
            onChange={setWeight}
            allowEmpty
          />
        </Field>
      ) : (
        <p className="text-tiny text-muted-foreground">Вес записывается только с согласия клиента на данные о здоровье.</p>
      )}
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
          if (!healthOk) {
            onSave({ firstName, lastName });
            return;
          }
          const kg = Number(weight.replace(",", "."));
          const today = isoDate(new Date());
          const history = [...client.weightHistory.filter((p) => p.date !== today), { date: today, kg: kg || client.weight }];
          onSave({ firstName, lastName, weight: kg || client.weight, weightHistory: history });
        }}
      >
        Сохранить замеры
      </button>
      {askRemove ? (
        <div className="flex flex-col gap-2 rounded-xl bg-secondary/40 p-3">
          <p className="text-tiny text-muted-foreground">
            Удалятся питание, замеры и записи без возможности вернуть. Чтобы подтвердить, введите имя «{client.firstName}».
          </p>
          <input className={inputClass} value={typed} onChange={(e) => setTyped(e.target.value)} />
          <button
            type="button"
            disabled={typed.trim() !== client.firstName.trim()}
            onClick={onRemove}
            className="pressable h-11 rounded-xl bg-secondary text-sm font-medium disabled:opacity-40"
          >
            Удалить навсегда
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setAskRemove(true)} className="h-11 text-sm text-muted-foreground">
          Удалить клиента
        </button>
      )}
    </div>
  );
}
