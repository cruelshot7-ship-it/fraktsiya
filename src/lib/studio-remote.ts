import { TRAINER_TG_ID } from "@/data/studio";
import type { StudioPayload } from "@/lib/studio-sync";

const CMD_LANG = "zz";

async function token() {
  const { env } = await import("@/lib/env.server");
  return env("BOT_TOKEN");
}

async function tg(tok: string, method: string, body?: FormData | Record<string, unknown>) {
  const url = `https://api.telegram.org/bot${tok}/${method}`;
  const res =
    body instanceof FormData
      ? await fetch(url, { method: "POST", body })
      : await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });
  return (await res.json()) as { ok: boolean; result?: any; description?: string };
}

async function readFileId(tok: string): Promise<string | null> {
  const res = await tg(tok, "getMyCommands", { language_code: CMD_LANG });
  // a refused call is not "no copy": the caller must see the failure, not an empty state
  if (!res.ok) throw new Error(`telegram getMyCommands: ${res.description ?? "failed"}`);
  const desc = res.result?.[0]?.description as string | undefined;
  return desc?.trim() || null;
}

/**
 * The Telegram copy, read strictly: null only when no copy was ever written.
 * Any failure throws, so a missing copy cannot be mistaken for an empty studio.
 */
export async function loadRemoteStrict(): Promise<StudioPayload | null> {
  const tok = await token();
  if (!tok) return null;
  const fileId = await readFileId(tok);
  if (!fileId) return null;
  const file = await tg(tok, "getFile", { file_id: fileId });
  if (!file.ok) throw new Error(`telegram getFile: ${file.description ?? "failed"}`);
  const path = file.result?.file_path as string | undefined;
  if (!path) throw new Error("telegram getFile: no file_path");
  const raw = await fetch(`https://api.telegram.org/file/bot${tok}/${path}`);
  if (!raw.ok) throw new Error(`telegram file download: ${raw.status}`);
  return (await raw.json()) as StudioPayload;
}

export async function loadRemote(): Promise<StudioPayload | null> {
  const tok = await token();
  if (!tok) return null;
  try {
    const fileId = await readFileId(tok);
    if (!fileId) return null;
    const file = await tg(tok, "getFile", { file_id: fileId });
    const path = file.result?.file_path as string | undefined;
    if (!path) return null;
    const raw = await fetch(`https://api.telegram.org/file/bot${tok}/${path}`);
    if (!raw.ok) return null;
    return (await raw.json()) as StudioPayload;
  } catch {
    return null;
  }
}

export async function sendMorningNote(text: string): Promise<boolean> {
  const tok = await token();
  if (!tok) return false;
  try {
    const sent = await tg(tok, "sendMessage", {
      chat_id: TRAINER_TG_ID,
      text: text.slice(0, 3500),
      protect_content: true,
    });
    const { messageIdOf, recordBotMessage } = await import("@/lib/bot-retention.server");
    await recordBotMessage(TRAINER_TG_ID, messageIdOf(sent), "digest");
    return Boolean(sent.ok);
  } catch {
    return false;
  }
}
