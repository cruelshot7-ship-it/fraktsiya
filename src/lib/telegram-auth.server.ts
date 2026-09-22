import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env.server";
import { TRAINER_TG_ID } from "@/data/studio";

export type TelegramAuthUser = {
  id: string;
  firstName: string;
  lastName: string;
  username: string | null;
};

export type TelegramSession = {
  user: TelegramAuthUser;
  role: "trainer" | "client";
  startParam: string;
};

function trainerId() {
  return env("TRAINER_TG_ID") || TRAINER_TG_ID;
}

export function verifyTelegramInitData(initData: string | undefined): TelegramSession | null {
  const botToken = env("BOT_TOKEN");
  const raw = (initData ?? "").trim();
  if (!botToken || !raw) return null;

  const params = new URLSearchParams(raw);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const digest = createHmac("sha256", secret).update(dataCheckString).digest("hex");
  const a = Buffer.from(digest, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate || Math.abs(Date.now() / 1000 - authDate) > 86400 * 2) return null;

  let parsed: { id?: number; first_name?: string; last_name?: string; username?: string };
  try {
    parsed = JSON.parse(params.get("user") || "{}") as typeof parsed;
  } catch {
    return null;
  }
  if (!parsed.id) return null;
  const id = String(parsed.id);
  return {
    user: {
      id,
      firstName: parsed.first_name?.trim() || "Клиент",
      lastName: parsed.last_name?.trim() || "",
      username: parsed.username?.trim() || null,
    },
    role: id === trainerId() ? "trainer" : "client",
    startParam: (params.get("start_param") || "").trim(),
  };
}
