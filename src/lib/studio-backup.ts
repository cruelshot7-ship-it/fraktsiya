/** Railway has no volume. The database is Postgres (Neon) or in-memory PGLite. */
export const DATABASE_ON_VOLUME = false;

export function databaseLocation() {
  return {
    engine: "postgres" as const,
    volume: DATABASE_ON_VOLUME,
    offsite: "telegram-file" as const,
  };
}

export function backupDay(now = new Date()) {
  const minsk = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  return minsk.toISOString().slice(0, 10);
}

export function shouldSendBackup(lastDay: string | null | undefined, today: string) {
  return Boolean(today) && lastDay !== today;
}

export function backupFileName(day: string) {
  return `ruksha-db-${day}.json`;
}
