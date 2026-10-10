import { createHash } from "node:crypto";
import { applyOfferBooking, BOT_USERNAME, clientCoach, coachKey, coachPhase, COACH_TRIAL_CAP, emptyClient, formatLongDate, hoursAgoIso, TRAINER_TG_ID, type JoinRequest } from "@/data/studio";
import { dueReminders, findByToken, markReminder, remindToken } from "@/lib/studio-remind";
import { dropTombstones, emptyPayload, loadStudioState, saveStudioState } from "@/lib/studio-sync";
import {
  buildSessions,
  findClients,
  parseImportCommand,
  PROGRAM_PROMPT,
  programCommandFromReply,
  splitDays,
  trainerCabinetText,
  type ImportCommand,
} from "@/lib/program-import";

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

function cabinetKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "Добавить программу", callback_data: "prog:add" }],
      [{ text: "Открыть кабинет", web_app: { url: APP_URL } }],
    ],
  };
}

/** Programs can be written while the coach's trial or paid access lasts; the trainer's own account always can. */
function coachWritesAllowed(coaches: { telegramId?: string | null; addedAt?: string | null; paidUntil?: string | null }[] | undefined, coachId: string) {
  const mine = coachKey(coachId);
  if (mine === String(TRAINER_TG_ID)) return true;
  const row = (coaches ?? []).find((c) => c.telegramId === mine);
  if (!row) return false;
  const phase = coachPhase(row);
  return phase === "trial" || phase === "paid";
}

async function isCoach(id: string) {
  if (id === String(TRAINER_TG_ID)) return true;
  return (await loadStudioState()).coaches?.some((c) => c.telegramId === id) ?? false;
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
  // The app calls this on every open (studio-store), so an existing client gets no message here:
  // a bot message on each open was spam. The app itself is already open for them.
  if (inHall) return { ok: true, already: true };
  if (!message) return { ok: false, already: false };
  const coachId = (offer?.coachId ?? "").trim();
  if (!coachId) {
    await tg("sendMessage", {
      chat_id: user.id,
      text: "Не удалось определить тренера. Откройте зал из меню бота и отправьте заявку ещё раз.",
    });
    return { ok: false, already: false };
  }
  const prev = (payload.joinRequests ?? []).find((r) => r.telegramId === user.id && r.status === "pending");
  if (prev?.coachId && prev.coachId !== coachId) return { ok: true, already: true };
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
    coachId,
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
  const notifyId = req.coachId;
  if (!notifyId) return { ok: false, already: false };
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
          coachId: req?.coachId || null,
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
    reply_to_message?: { text?: string };
  };
  callback_query?: {
    id: string;
    data?: string;
    from: { id: number };
    message?: { chat: { id: number }; message_id: number };
  };
};

export async function handleTelegramUpdate(update: TgUpdate) {
  try {
    const current = await loadStudioState();
    const next = await sendDueReminders(current);
    if (next !== current) await saveStudioState(next);
  } catch {
    /* a missed ping must not block /start */
  }

  const cb = update.callback_query;
  if (cb?.data) {
    const cut = cb.data.indexOf(":");
    const action = cut < 0 ? cb.data : cb.data.slice(0, cut);
    const id = cut < 0 ? "" : cb.data.slice(cut + 1);
    if (action === "prog") {
      const coachId = String(cb.from.id);
      if (!(await isCoach(coachId))) {
        await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Только для тренера.", show_alert: true });
        return;
      }
      // a prompt that would be refused at the end is refused now, before the trainer types anything
      let allowed = true;
      try {
        allowed = coachWritesAllowed((await loadStudioState()).coaches, coachId);
      } catch {
        allowed = true;
      }
      if (!allowed) {
        await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Пробный доступ закончился. Программы сейчас не записываются.", show_alert: true });
        return;
      }
      await tg("answerCallbackQuery", { callback_query_id: cb.id });
      await tg("sendMessage", {
        chat_id: cb.from.id,
        text: `${PROGRAM_PROMPT} ответом на это сообщение. Первая строка — имя клиента, дальше упражнения, как в описании выше.`,
        reply_markup: { force_reply: true, input_field_placeholder: "Елена" },
      });
      return;
    }
    if ((action === "y" || action === "m") && id) {
      let payload = emptyPayload();
      try {
        payload = await loadStudioState();
      } catch {
        payload = emptyPayload();
      }
      const booking = findByToken(payload.bookings, id);
      const fromId = String(cb.from.id);
      const client = booking ? payload.clients.find((row) => row.id === booking.clientId) : undefined;
      if (!booking || client?.telegramId !== fromId) {
        await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Запись не найдена.", show_alert: true });
        return;
      }
      if (action === "y") {
        payload = {
          ...payload,
          bookings: payload.bookings.map((row) => (row.id === booking.id ? { ...row, confirmed: true } : row)),
        };
        await saveStudioState(payload);
        const coach = clientCoach(client);
        await tg("sendMessage", {
          chat_id: coach,
          text: `${client.firstName} подтвердил ${formatLongDate(booking.date)} · ${booking.time}`,
        });
        await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Принято. Ждём вас." });
      } else {
        await tg("sendMessage", {
          chat_id: fromId,
          text: "Откройте слоты и выберите другое время. Текущая запись пока на месте — отмените её в приложении, если переносите.",
          reply_markup: webAppKeyboard("Открыть слоты"),
        });
        await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Откройте слоты" });
      }
      if (cb.message) {
        await tg("editMessageReplyMarkup", {
          chat_id: cb.message.chat.id,
          message_id: cb.message.message_id,
          reply_markup: { inline_keyboard: [] },
        });
      }
      return;
    }
    if ((action === "ok" || action === "no") && id) {
      let payload = emptyPayload();
      try {
        payload = await loadStudioState();
      } catch {
        payload = emptyPayload();
      }
      const req = (payload.joinRequests ?? []).find((r) => r.telegramId === id);
      const fromId = String(cb.from.id);
      if (!req?.coachId || fromId !== req.coachId) {
        await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Это не ваш клиент.", show_alert: true });
        return;
      }
      const coach = (payload.coaches ?? []).find((c) => c.telegramId === fromId);
      if (coach) {
        const phase = coachPhase(coach);
        if (phase !== "trial" && phase !== "paid") {
          await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Пробный доступ закончился.", show_alert: true });
          return;
        }
        if (action === "ok" && phase === "trial" && payload.clients.filter((c) => c.coachId === fromId).length >= COACH_TRIAL_CAP) {
          await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "На пробе не больше 15 клиентов.", show_alert: true });
          return;
        }
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

  if (await isCoach(id)) {
    if (text.startsWith("/start")) {
      await ensureBotHook();
      await tg("sendMessage", {
        chat_id: from.id,
        text: trainerCabinetText(),
        reply_markup: cabinetKeyboard(),
      });
      return;
    }
    // an answer to «Добавить программу» is the program without the /program word
    const asked = (msg?.reply_to_message?.text ?? "").startsWith(PROGRAM_PROMPT);
    const cmd = parseImportCommand(asked ? programCommandFromReply(text) : text);
    if (cmd) {
      await tg("sendMessage", { chat_id: from.id, text: await importProgramFromChat(id, cmd) });
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

/** Writes a program the trainer sent in chat to one of their clients. Replaces the client's days. */
async function importProgramFromChat(coachId: string, cmd: ImportCommand): Promise<string> {
  if (!cmd.ok) return cmd.error;
  let payload = emptyPayload();
  try {
    payload = await loadStudioState();
  } catch {
    return "Не удалось открыть данные. Программа не записана, попробуйте ещё раз.";
  }
  if (!coachWritesAllowed(payload.coaches, coachId)) return "Пробный доступ закончился. Программы сейчас не записываются.";
  const mine = coachKey(coachId);

  const found = findClients(
    payload.clients.filter((c) => clientCoach(c) === mine),
    cmd.query,
  );
  if (found.length === 0) return `Клиент «${cmd.query}» не найден среди ваших. Укажите имя или @ник как в карточке.`;
  if (found.length > 1) {
    const names = found.slice(0, 5).map((c) => `${c.firstName} ${c.lastName}`.trim()).join(", ");
    return `Под «${cmd.query}» подходят: ${names}. Уточните имя или напишите @ник.`;
  }
  const target = found[0];
  const who = `${target.firstName} ${target.lastName}`.trim();
  const existing = (target.sessions ?? []).filter((s) => (s.items ?? []).length > 0);
  if (existing.length && !cmd.force) {
    return `У «${who}» уже есть программа (${existing.length} дн.). Чтобы заменить её, отправьте /program! ${cmd.query} и строки программы. Старая пропадёт.`;
  }

  const split = splitDays(cmd.body);
  if (!split.ok) return split.error;
  const { sessions, warnings } = buildSessions(split.days);
  const now = new Date().toISOString();
  const next = {
    ...payload,
    clients: payload.clients.map((c) => (c.id === target.id ? { ...c, sessions, programAt: now } : c)),
  };
  try {
    await saveStudioState(next);
  } catch (err) {
    console.error("[program-import]", err);
    return "Не сохранилось, программа не записана. Попробуйте ещё раз.";
  }
  const exercises = sessions.reduce((n, s) => n + s.blocks.length, 0);
  const lines = sessions.map((s) => `${s.name}: ${s.blocks.length} упр.`);
  return [
    `Программа «${who}» записана: ${sessions.length} дн., ${exercises} упр.`,
    ...lines,
    ...(warnings.length ? ["", ...warnings.map((w) => `⚠ ${w}`)] : []),
    "",
    "Прежняя программа заменена. Проверьте в кабинете.",
  ].join("\n");
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

let remindBusy = false;

export async function sendDueReminders(payload: import("@/lib/studio-sync").StudioPayload) {
  if (remindBusy) return payload;
  const due = dueReminders(payload.bookings, Date.now());
  if (!due.length) return payload;
  remindBusy = true;
  let bookings = payload.bookings;
  try {
    for (const item of due) {
      const booking = bookings.find((row) => row.id === item.id);
      const client = payload.clients.find((row) => row.id === booking?.clientId);
      if (!booking || !client?.telegramId) continue;
      const when = `${formatLongDate(booking.date)} · ${booking.time}`;
      const text =
        item.kind === "2"
          ? `Через пару часов тренировка\n${when}\nПодтвердите или перенесите.`
          : `Завтра тренировка\n${when}\nПодтвердите или перенесите.`;
      const token = remindToken(booking.id);
      const sent = await tg("sendMessage", {
        chat_id: client.telegramId,
        text,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Подтверждаю", callback_data: `y:${token}` },
              { text: "Перенести", callback_data: `m:${token}` },
            ],
          ],
        },
      });
      if (sent.ok) bookings = markReminder(bookings, booking.id, item.kind);
    }
  } finally {
    remindBusy = false;
  }
  if (bookings === payload.bookings) return payload;
  return { ...payload, bookings };
}
