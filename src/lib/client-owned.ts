/**
 * Fields a client writes about themselves. A trainer's push carries a copy that may be
 * older than the server's, so these fields always come from the server copy.
 * Weight and weight history are NOT here: the trainer edits them in the client editor.
 */
import type { Client } from "@/data/studio";

export function keepClientOwned(server: Client | undefined, incoming: Client): Client {
  if (!server) return incoming;
  return {
    ...incoming,
    measures: server.measures ?? [],
    consent: server.consent ?? null,
    erasedAt: server.erasedAt ?? null,
    lastReportAt: server.lastReportAt,
    streak: server.streak,
    consentLog: server.consentLog ?? [],
  };
}
