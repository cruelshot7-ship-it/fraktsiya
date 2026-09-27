import { createFileRoute } from "@tanstack/react-router";

function tokenOf(request: Request) {
  const url = new URL(request.url);
  const fromQuery = (url.searchParams.get("token") || "").trim().toLowerCase();
  if (fromQuery) return fromQuery;
  const header = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim().toLowerCase();
  return header;
}

async function readBody(request: Request) {
  const url = new URL(request.url);
  const fromQuery: Record<string, unknown> = {};
  for (const key of ["steps", "sleep", "sleepHours", "moveMin", "exercise", "water", "waterMl", "date"]) {
    const value = url.searchParams.get(key);
    if (value != null) fromQuery[key] = value;
  }
  if (request.method === "GET") return fromQuery;
  const text = await request.text();
  if (!text.trim()) return fromQuery;
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return { ...fromQuery, ...parsed };
  } catch {
    return fromQuery;
  }
}

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async ({ request }) => ingest(request),
      POST: async ({ request }) => ingest(request),
    },
  },
});

async function ingest(request: Request) {
  const token = tokenOf(request);
  if (!/^[a-z0-9]{20,64}$/.test(token)) return Response.json({ ok: false }, { status: 404 });
  const { loadStudioState, saveStudioState } = await import("@/lib/studio-sync");
  const payload = await loadStudioState();
  const client = payload.clients.find((row) => (row.healthToken || "").toLowerCase() === token);
  if (!client) return Response.json({ ok: false }, { status: 404 });
  const url = new URL(request.url);
  if (url.searchParams.get("ping") === "1") return Response.json({ ok: true, linked: true });
  const { healthDays, applyHealthDays } = await import("@/lib/health-ingest");
  const body = await readBody(request);
  const days = healthDays(body);
  if (!days.size) return Response.json({ ok: true, updated: 0 });
  const applied = applyHealthDays(payload.dayChecks ?? [], client.id, days);
  if (applied.updated) await saveStudioState({ ...payload, dayChecks: applied.dayChecks });
  return Response.json({ ok: true, updated: applied.updated });
}
