const DEMO_IDS = new Set(["c_maria", "c_igor", "c_artem", "c_dmitry", "c_olga", "c_sveta"]);

export function isDemoClientId(id: string) {
  return DEMO_IDS.has(id);
}

export function stripDemoData<T extends {
  clients: { id: string }[];
  bookings: { id: string; clientId: string }[];
  food: { clientId: string }[];
  lifts: { clientId: string }[];
  notices: { clientId: string }[];
  waitlist: { clientId: string }[];
  workoutLogs: { clientId: string }[];
}>(state: T): T {
  const clients = state.clients.filter((c) => !DEMO_IDS.has(c.id));
  const keep = new Set(clients.map((c) => c.id));
  const live = (id: string) => keep.has(id);
  return {
    ...state,
    clients,
    bookings: state.bookings.filter((b) => live(b.clientId) && !String(b.id).startsWith("bk_seed_")),
    food: state.food.filter((f) => live(f.clientId)),
    lifts: state.lifts.filter((l) => live(l.clientId)),
    notices: state.notices.filter((n) => live(n.clientId)),
    waitlist: state.waitlist.filter((w) => live(w.clientId)),
    workoutLogs: state.workoutLogs.filter((w) => live(w.clientId)),
  };
}
