import { weightDelta } from "@/data/studio";
import { specialDataAllowed } from "@/lib/privacy";
import { activeClient, useStudio } from "@/lib/studio-store";
import { SectionLabel, Surface } from "@/components/app/bits";
import { MeasuresCard } from "@/components/app/measures-card";
import { FormView } from "@/components/app/form-view";

/**
 * Прогресс клиента: вес за неделю, замеры и самочувствие. Здоровые данные
 * (вес, замеры, самочувствие) показываются только с согласия; проверка — внутри карточек.
 */
export function ProgressView() {
  const clients = useStudio((s) => s.clients);
  const activeClientId = useStudio((s) => s.activeClientId);
  const me = activeClient({ clients, activeClientId });
  if (!me) {
    return <p className="text-sm text-muted-foreground">Прогресс появится, когда тренер добавит вас.</p>;
  }
  const allowed = specialDataAllowed(me.consent);
  const delta = weightDelta(me.weightHistory);

  return (
    <div className="space-y-4">
      <SectionLabel>Вес</SectionLabel>
      {allowed ? (
        <Surface>
          <p className="font-display text-3xl tabular-nums">
            {me.weight.toFixed(1).replace(".", ",")}
            <span className="ml-1 text-base text-muted-foreground">кг</span>
          </p>
          <p className="mt-1 text-tiny text-muted-foreground">
            {delta > 0 ? "+" : ""}
            {delta.toFixed(1).replace(".", ",")} кг за 7 дней
          </p>
        </Surface>
      ) : (
        <Surface>
          <p className="text-tiny text-muted-foreground">
            Вес и замеры — с вашего согласия. Дать его можно в «Профиль» → «Мои данные».
          </p>
        </Surface>
      )}
      <MeasuresCard client={me} />
      <SectionLabel>Самочувствие</SectionLabel>
      <FormView />
    </div>
  );
}
