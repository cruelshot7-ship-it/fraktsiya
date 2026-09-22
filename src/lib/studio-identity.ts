import { TRAINER_TG_ID, emptyClient, type Client, type Notice } from "@/data/studio";
import { getTelegramInitData, getTelegramUser } from "@/lib/telegram";
import { pullStudio, pushStudio, type StudioPayload } from "@/lib/studio-sync";

type Role = "client" | "trainer";

function normName(value: string | null | undefined) {
  return (value ?? "").replace(/^@/, "").trim().toLowerCase();
}

export function isTrainerTelegramId(id: string | number | null | undefined) {
  return String(id ?? "").trim() === String(TRAINER_TG_ID).trim();
}

export function telegramLocked(): boolean {
  return Boolean(getTelegramUser());
}

export function applyTelegramIdentity(state: {
  clients: Client[];
  activeClientId: string;
  role: Role;
  notices: Notice[];
}): {
  clients: Client[];
  activeClientId: string;
  role: Role;
  notices: Notice[];
  identityLocked: boolean;
} {
  const user = getTelegramUser();
  if (!user) {
    return { ...state, identityLocked: false };
  }
  const id = String(user.id);
  if (isTrainerTelegramId(id)) {
    return { ...state, role: "trainer", identityLocked: true };
  }

  let clients = state.clients;
  let mine = clients.find((c) => c.telegramId === id);
  if (!mine && user.username) {
    const uname = normName(user.username);
    mine = clients.find((c) => normName(c.telegramUsername) === uname);
    if (mine) {
      clients = clients.map((c) =>
        c.id === mine!.id ? { ...c, telegramId: id, telegramUsername: user.username ?? c.telegramUsername } : c,
      );
      mine = clients.find((c) => c.telegramId === id);
    }
  }
  if (!mine) {
    const base = emptyClient();
    mine = {
      ...base,
      id: `tg_${id}`,
      firstName: user.first_name?.trim() || "Клиент",
      lastName: user.last_name?.trim() || "",
      telegramId: id,
      telegramUsername: user.username ?? null,
      sessionsLeft: 0,
      packExpiresAt: null,
      lastReportAt: null,
      streak: 0,
      programTitle: "",
      sessions: [],
      trainDays: [],
      trainTimes: [],
      weight: 0,
      weightHistory: [],
      kbju: { calories: 0, protein: 0, fat: 0, carbs: 0 },
    };
    clients = [...clients, mine];
  }
  return {
    clients,
    activeClientId: mine.id,
    role: "client",
    notices: state.notices,
    identityLocked: true,
  };
}

let pushTimer: ReturnType<typeof setTimeout> | undefined;

export function scheduleCloudPush(payload: StudioPayload) {
  const initData = getTelegramInitData();
  if (!initData) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    void pushStudio({ data: { initData, payload } }).catch(() => undefined);
  }, 700);
}

export async function syncFromCloud(): Promise<null | {
  role: Role;
  payload: StudioPayload;
  created: boolean;
}> {
  const initData = getTelegramInitData();
  if (!initData) return null;
  try {
    const res = await pullStudio({ data: { initData } });
    if (!res.ok || !res.payload || !res.role) return null;
    return { role: res.role, payload: res.payload, created: Boolean(res.created) };
  } catch {
    return null;
  }
}
