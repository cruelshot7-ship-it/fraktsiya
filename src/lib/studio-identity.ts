import { TRAINER_TG_ID, type Client, type Notice } from "@/data/studio";
import { getTelegramInitData, getTelegramUser } from "@/lib/telegram";
import { pullStudio, pushStudio, type StudioPayload } from "@/lib/studio-sync";

type Role = "client" | "trainer";

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
  inviteBlocked: boolean;
} {
  const user = getTelegramUser();
  if (!user) {
    return { ...state, identityLocked: false, inviteBlocked: false };
  }
  const id = String(user.id);
  if (isTrainerTelegramId(id)) {
    return { ...state, role: "trainer", identityLocked: true, inviteBlocked: false };
  }

  return {
    clients: [],
    activeClientId: "",
    role: "client",
    notices: state.notices,
    identityLocked: true,
    inviteBlocked: true,
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
  blocked?: boolean;
}> {
  const initData = getTelegramInitData();
  if (!initData) return null;
  try {
    const res = await pullStudio({ data: { initData } });
    if (!res.ok || !res.payload || !res.role) return null;
    return { role: res.role, payload: res.payload, created: Boolean(res.created), blocked: Boolean(res.blocked) };
  } catch {
    return null;
  }
}
