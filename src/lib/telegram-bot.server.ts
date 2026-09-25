import { createHash } from "node:crypto";
import { applyOfferBooking, BOT_USERNAME, clientCoach, coachKey, emptyClient, hoursAgoIso, TRAINER_TG_ID, type JoinRequest } from "@/data/studio";
import { dropTombstones, emptyPayload, loadStudioState, saveStudioState } from "@/lib/studio-sync";

const APP_URL = "https://ruksha.vercel.app";

async function botToken() {
  const { env } = await import("@/lib/env.server");
  return env("BOT_TOKEN");
}

export function webhookSecret(token: string) {
  return createHash("sha256").update(`ruksha:${token}`).digest("hex").slice(0, 32);
}

async function tg(method: string, body: Record<string, unknown>) {
  const tok = await botToken();
  if (!tok) return { ok: false as const, description: "no-token" };
  const res = await fetch(`https://api.telegram.org/bot${tok}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as { ok: boolean; description?: string; result?: unknown };
}

function webAppKeyboard(text: string) {
  return {
    inline_keyboard: [[{ text, web_app: { url: APP_URL } }]],
  };
}

function decideKeyboard(telegramId: string) {
  return {
    inline_keyboard: [
      [
        { text: "Принять", callback_data: `ok:${telegramId}` },
        { text: "Отклонить", callback_data: `no:${telegramId}` },
      ],
    ],
  };
}

export async function ensureBotHook(origin = APP_URL) {
  const tok = await botToken();
  if (!tok) return false;
  const url = `${origin.replace(/\/$/, "")}/api/telegram`;
  await tg("setWebhook", {
    url,
    secret_token: webhookSecret(tok),
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false,
  });
  await tg("setMyCommands", {
    commands: [{ command: "start", description: "Заявка в зал" }],
  });
  await tg("setChatMenuButton", {
    menu_button: { type: "web_app", text: "Зал", web_app: { url: APP_URL } },
  });
  return true;
}

export async function registerJoin(
  user: {
    id: string;
    firstName: string;
    lastName: string;
    username: string | null;
  },
  offer?: { message: string; slotId?: string; goal?: string; pack?: string; coachId?: string },
) {
  const message = (offer?.message ?? "").trim().slice(0, 500);
  let payload = emptyPayload();
  try {
    payload = await loadStudioState();
  } catch {
    payload = emptyPayload();
  }
  const uname = (user.username ?? "").replace(/^@/, "").trim().toLowerCase();
  const inHall = payload.clients.some(
    (c) =>
      c.telegramId === user.id ||
      (uname && (c.telegramUsername ?? "").replace(/^@/, "").trim().toLowerCase() === uname),
  );
  if (inHall) {
    await tg("sendMessage", {
      chat_id: user.id,
      text: "Вы уже в зале. Откройте приложение.",
      reply_markup: webAppKeyboard("Открыть зал"),
    });
    return { ok: true, already: true };
  }
  if (!message) return { ok: false, already: false };
  const prev = (payload.joinRequests ?? []).find((r) => r.telegramId === user.id && r.status === "pending");
  if (prev?.message === message) return { ok: true, already: false };
  const req: JoinRequest = {
    id: `jr_${user.id}`,
    telegramId: user.id,
    telegramUsername: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    message,
    slotId: offer?.slotId,
    goal: offer?.goal,
    pack: offer?.pack,
    coachId: coachKey(offer?.coachId),
    at: hoursAgoIso(0),
    status: "pending",
  };
  payload = {
    ...payload,
    joinRequests: [req, ...(payload.joinRequests ?? []).filter((r) => r.telegramId !== user.id)],
  };
  await saveStudioState(payload);
  const who = [req.firstName, req.lastName].filter(Boolean).join(" ");
  const handle = req.telegramUsername ? `@${req.telegramUsername}` : `id ${req.telegramId}`;
  const notifyId = coachKey(req.coachId);
  await tg("sendMessage", {
    chat_id: notifyId,
    text: `Заявка\n${who}\n${handle}\n\n${message}`,
    reply_markup: decideKeyboard(user.id),
  });
  await tg("sendMessage", {
    chat_id: user.id,
    text: "Заявка у тренера. Когда примет — откроется зал.",
    reply_markup: webAppKeyboard("Открыть заявку"),
  });
  return { ok: true, already: false };
}

export async function decideJoin(telegramId: string, approve: boolean) {
  let payload = emptyPayload();
  try {
    payload = await loadStudioState();
  } catch {
    payload = emptyPayload();
  }
  const req = (payload.joinRequests ?? []).find((r) => r.telegramId === telegramId);
  if (approve) {
    const uname = (req?.telegramUsername ?? "").replace(/^@/, "").trim().toLowerCase();
    const existing =
      payload.clients.find((c) => c.telegramId === telegramId) ??
      payload.clients.find((c) => uname && (c.telegramUsername ?? "").replace(/^@/, "").trim().toLowerCase() === uname);
    const fresh = existing
      ? null
      : {
          ...emptyClient(),
          id: `tg_${telegramId}`,
          firstName: req?.firstName || "Клиент",
          lastName: req?.lastName || "",
          telegramId,
          telegramUsername: req?.telegramUsername ?? null,
          coachId: coachKey(req?.coachId),
        };
    const clientId = fresh?.id ?? existing!.id;
    const withClient = fresh ? [...payload.clients, fresh] : payload.clients;
    const placed = applyOfferBooking({
      clients: withClient,
      bookings: payload.bookings,
      extraSlots: payload.extraSlots,
      closedSlotIds: payload.closedSlotIds,
      clientId,
      req: req ?? { id: "", telegramId, telegramUsername: null, firstName: "", lastName: "", message: "", at: "", status: "approved" },
    });
    const when = placed.booked && req?.slotId ? req.message.split("\n")[1] : "";
    payload = {
      ...payload,
      clients: placed.clients,
      bookings: placed.bookings,
      joinRequests: (payload.joinRequests ?? []).map((r) =>
        r.telegramId === telegramId ? { ...r, status: "approved" as const } : r,
      ),
      removedClientIds: dropTombstones(payload.removedClientIds ?? [], [
        telegramId,
        `tg:${telegramId}`,
        ...(req?.telegramUsername ? [`u:${req.telegramUsername.replace(/^@/, "").toLowerCase()}`] : []),
        fresh?.id ?? "",
      ].filter(Boolean)),
    };
    await saveStudioState(payload);
    await tg("sendMessage", {
      chat_id: telegramId,
      text: when
        ? `Вас приняли и записали: ${when}. Откройте зал.`
        : "Вас приняли в зал. Откройте приложение.",
      reply_markup: webAppKeyboard("Открыть зал"),
    });
    return { ok: true };
  }
  payload = {
    ...payload,
    joinRequests: (payload.joinRequests ?? []).map((r) =>
      r.telegramId === telegramId ? { ...r, status: "rejected" as const } : r,
    ),
  };
  await saveStudioState(payload);
  await tg("sendMessage", {
    chat_id: telegramId,
    text: "Пока без зала. Напишите тренеру, если это ошибка.",
  });
  return { ok: true };
}

type TgUpdate = {
  message?: {
    text?: string;
    chat: { id: number };
    from?: { id: number; first_name?: string; last_name?: string; username?: string };
  };
  callback_query?: {
    id: string;
    data?: string;
    from: { id: number };
    message?: { chat: { id: number }; message_id: number };
  };
};

export async function handleTelegramUpdate(update: TgUpdate) {
  const cb = update.callback_query;
  if (cb?.data) {
    const [action, id] = cb.data.split(":");
    if ((action === "ok" || action === "no") && id) {
      let payload = emptyPayload();
      try {
        payload = await loadStudioState();
      } catch {
        payload = emptyPayload();
      }
      const req = (payload.joinRequests ?? []).find((r) => r.telegramId === id);
      const fromId = String(cb.from.id);
      const allowed = fromId === String(TRAINER_TG_ID) || fromId === coachKey(req?.coachId);
      if (!allowed) {
        await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Это не ваш клиент.", show_alert: true });
        return;
      }
      await decideJoin(id, action === "ok");
      await tg("answerCallbackQuery", { callback_query_id: cb.id, text: action === "ok" ? "Принят" : "Отклонён" });
      if (cb.message) {
        await tg("editMessageReplyMarkup", {
          chat_id: cb.message.chat.id,
          message_id: cb.message.message_id,
          reply_markup: { inline_keyboard: [] },
        });
      }
    }
    return;
  }

  const msg = update.message;
  const text = (msg?.text ?? "").trim();
  const from = msg?.from;
  if (!from || !text) return;
  const id = String(from.id);

  if (id === String(TRAINER_TG_ID) || (await loadStudioState()).coaches?.some((c) => c.telegramId === id)) {
    if (text.startsWith("/start")) {
      await ensureBotHook();
      await tg("sendMessage", {
        chat_id: from.id,
        text: "Кабинет тренера.",
        reply_markup: webAppKeyboard("Открыть кабинет"),
      });
    }
    return;
  }

  if (text.startsWith("/start")) {
    await tg("sendMessage", {
      chat_id: from.id,
      text: "Выберите пакет и время в зале. Оплату обсудите с тренером лично.",
      reply_markup: webAppKeyboard("Выбрать время"),
    });
  }
}

export async function sendTrainerNote(
  from: { id: string; firstName: string; lastName: string; username: string | null },
  text: string,
) {
  const who = [from.firstName, from.lastName].filter(Boolean).join(" ") || "Клиент";
  const handle = from.username ? `@${from.username}` : `id ${from.id}`;
  const body = text.trim().slice(0, 1000);
  if (!body) return { ok: false as const };
  let chat = String(TRAINER_TG_ID);
  try {
    const payload = await loadStudioState();
    const client = payload.clients.find((c) => c.telegramId === from.id);
    if (client) chat = clientCoach(client);
  } catch {
    chat = String(TRAINER_TG_ID);
  }
  const rows: { text: string; url?: string; web_app?: { url: string } }[][] = [];
  if (from.username) rows.push([{ text: "Ответить в Telegram", url: `https://t.me/${from.username}` }]);
  rows.push([{ text: "Кабинет", web_app: { url: APP_URL } }]);
  return tg("sendMessage", {
    chat_id: chat,
    text: `Сообщение из зала\n${who}\n${handle}\n\n${body}`,
    reply_markup: { inline_keyboard: rows },
  });
}

export async function sendBotLink(telegramId: string, text: string) {
  return tg("sendMessage", {
    chat_id: telegramId,
    text,
    reply_markup: webAppKeyboard("Открыть зал"),
  });
}
