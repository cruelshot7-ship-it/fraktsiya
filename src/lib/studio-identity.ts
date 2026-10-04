import { TRAINER_TG_ID, type Client, type Notice } from "@/data/studio";
import { getTelegramInitData, getTelegramUser } from "@/lib/telegram";
import { pullStudio, pushStudio, type StudioPayload } from "@/lib/studio-sync";

type Role = "client" | "trainer";

const DIRTY_KEY = "ruksha:dirty";
const RETRY_MS = [2000, 5000, 15000] as const;

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
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let latest: StudioPayload | null = null;
let inFlight = false;

function setDirty(on: boolean) {
  try {
    if (typeof localStorage === "undefined") return;
    if (on) localStorage.setItem(DIRTY_KEY, "1");
    else localStorage.removeItem(DIRTY_KEY);
  } catch {
    /* private mode */
  }
}

export function hasUnsyncedChanges(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(DIRTY_KEY) === "1";
  } catch {
    return false;
  }
}

async function pushLatest(attempt: number) {
  const initData = getTelegramInitData();
  const payload = latest;
  if (!initData || !payload || inFlight) return;
  inFlight = true;
  let ok = false;
  try {
    const res = await pushStudio({ data: { initData, payload } });
    ok = Boolean(res && (res as { ok?: boolean }).ok);
  } catch {
    ok = false;
  } finally {
    inFlight = false;
  }

  if (ok) {
    if (latest === payload) {
      latest = null;
      setDirty(false);
    } else if (latest) {
      void pushLatest(0);
    }
    return;
  }

  if (attempt < RETRY_MS.length) {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      void pushLatest(attempt + 1);
    }, RETRY_MS[attempt]);
  }
}

export function scheduleCloudPush(payload: StudioPayload) {
  const initData = getTelegramInitData();
  if (!initData) return;
  latest = payload;
  setDirty(true);
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    void pushLatest(0);
  }, 700);
}

export function flushCloudPush() {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = undefined;
  }
  void pushLatest(0);
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushCloudPush();
  });
}
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    flushCloudPush();
  });
}

export async function syncFromCloud(phone?: string): Promise<null | {
  role: Role;
  payload: StudioPayload;
  created: boolean;
  blocked?: boolean;
}> {
  const initData = getTelegramInitData();
  if (!initData) return null;
  try {
    const res = await pullStudio({ data: { initData, phone } });
    if (!res.ok || !res.payload || !res.role) return null;
    return { role: res.role, payload: res.payload, created: Boolean(res.created), blocked: Boolean(res.blocked) };
  } catch {
    return null;
  }
}
