/** Pure merge helpers for studio sync (no server imports). */

export const DISMISSED_CAP = 500;

export function unionIds(a: string[] = [], b: string[] = []) {
  return [...new Set([...a, ...b])].slice(-DISMISSED_CAP);
}

export function mergeBookingFlags<T extends { confirmed?: boolean; checkedIn?: boolean; noShow?: boolean }>(
  row: T,
  prev?: T,
): T {
  return {
    ...row,
    confirmed: row.confirmed || prev?.confirmed,
    checkedIn: row.checkedIn || prev?.checkedIn,
    noShow: row.noShow || prev?.noShow,
  };
}

/** Only allow dismissing notices that belong to this client. */
export function ownDismissed(
  current: string[],
  incoming: string[],
  notices: { id: string; clientId?: string }[],
  clientId: string,
) {
  const own = new Set(notices.filter((n) => n.clientId === clientId).map((n) => n.id));
  return unionIds(current, incoming.filter((x) => own.has(x)));
}
