from pathlib import Path

p = Path("src/lib/studio-sync.ts")
t = p.read_text()
old = '''export function coachFromStart(start: string, payload: StudioPayload) {
  const match = /^c_([a-z0-9]+)$/i.exec((start ?? "").trim());
  if (!match) return "";
  const token = match[1];
  if (token === String(TRAINER_TG_ID)) return String(TRAINER_TG_ID);
  const coach = (payload.coaches ?? []).find((c) => c.code === token || c.telegramId === token);
  if (!coach?.telegramId) return "";
  const phase = coachPhase(coach);
  if (phase !== "trial" && phase !== "paid") return "";
  return coach.telegramId;
}'''
new = '''export function coachFromStart(start: string, payload: StudioPayload) {
  const raw = (start ?? "").trim();
  const match = /^c_([a-z0-9]+)$/i.exec(raw);
  // No deep-link (opened Mini App / bot without c_CODE) → main trainer (Ruksha).
  if (!match) return String(TRAINER_TG_ID);
  const token = match[1];
  if (token === String(TRAINER_TG_ID)) return String(TRAINER_TG_ID);
  const coach = (payload.coaches ?? []).find((c) => c.code === token || c.telegramId === token);
  if (!coach?.telegramId) return String(TRAINER_TG_ID);
  const phase = coachPhase(coach);
  if (phase !== "trial" && phase !== "paid") return "";
  return coach.telegramId;
}'''
if "No deep-link (opened Mini App" in t:
    print("studio-sync already")
elif old not in t:
    raise SystemExit("coachFromStart missing")
else:
    t = t.replace(old, new, 1)
    p.write_text(t)
    print("studio-sync patched")

p = Path("src/lib/telegram-bot.server.ts")
t = p.read_text()
old_msg = '''  if (!coachId) {
    await tg("sendMessage", {
      chat_id: user.id,
      text: "Нужна личная ссылка тренера. Общая ссылка бота заявку не создаёт.",
    });
    return { ok: false, already: false };
  }'''
new_msg = '''  if (!coachId) {
    await tg("sendMessage", {
      chat_id: user.id,
      text: "Не удалось определить тренера. Откройте зал из меню бота и отправьте заявку ещё раз.",
    });
    return { ok: false, already: false };
  }'''
if "Не удалось определить тренера" in t:
    print("bot already")
elif old_msg not in t:
    print("bot msg pattern skip")
else:
    p.write_text(t.replace(old_msg, new_msg, 1))
    print("bot patched")
