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
  const desc = res.result?.[0]?.description as string | undefined;
  return desc?.trim() || null;
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

export async function saveRemote(payload: StudioPayload): Promise<boolean> {
  const tok = await token();
  if (!tok) return false;
  try {
    const bytes = Buffer.from(JSON.stringify(payload), "utf8");
    const form = new FormData();
    form.set("chat_id", TRAINER_TG_ID);
    form.set("disable_notification", "true");
    form.set("document", new File([new Uint8Array(bytes)], "studio.json", { type: "application/json" }));
    const sent = await tg(tok, "sendDocument", form);
    const fileId = sent.result?.document?.file_id as string | undefined;
    if (!fileId) return false;
    await tg(tok, "setMyCommands", {
      language_code: CMD_LANG,
      commands: [{ command: "er", description: fileId.slice(0, 256) }],
    });
    return true;
  } catch {
    return false;
  }
}
