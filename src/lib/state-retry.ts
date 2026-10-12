/**
 * Запись состояния с повтором при гонке. Чистая логика без базы: загрузка, применение и запись передаются снаружи.
 * Каждая попытка читает свежую копию, поэтому чужая запись не затирается.
 */
export type RetryOutcome = "saved" | "unchanged" | "conflict";

export async function retryUpdate<T>(opts: {
  load: () => Promise<T>;
  save: (next: T) => Promise<void>;
  mutate: (current: T) => T | null;
  isConflict: (err: unknown) => boolean;
  attempts?: number;
}): Promise<RetryOutcome> {
  const attempts = opts.attempts ?? 3;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const current = await opts.load();
    const next = opts.mutate(current);
    if (next === null) return "unchanged";
    try {
      await opts.save(next);
      return "saved";
    } catch (err) {
      if (!opts.isConflict(err)) throw err;
    }
  }
  return "conflict";
}
