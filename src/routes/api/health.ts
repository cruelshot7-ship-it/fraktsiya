import { createFileRoute } from "@tanstack/react-router";

function tokenOf(request: Request): string {
  return (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim()
    .toLowerCase();
}

async function readBody(request: Request) {
  if (request.method === "GET") return {};
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = tokenOf(request);
        if (!/^[a-z0-9]{20,64}$/.test(token)) {
          return Response.json({ ok: false }, { status: 404 });
        }
        const { loadStudioState } = await import("@/lib/studio-sync");
        const payload = await loadStudioState();
        const client = payload.clients.find(
          (row) => (row.healthToken || "").toLowerCase() === token,
        );
        if (!client) return Response.json({ ok: false }, { status: 404 });
        return Response.json({ ok: true, linked: true });
      },
      POST: async ({ request }) => {
        const token = tokenOf(request);
        if (!/^[a-z0-9]{20,64}$/.test(token)) {
          return Response.json({ ok: false }, { status: 404 });
        }
        const { loadStudioState, saveStudioState } = await import("@/lib/studio-sync");
        const payload = await loadStudioState();
        const client = payload.clients.find(
          (row) => (row.healthToken || "").toLowerCase() === token,
        );
        if (!client) return Response.json({ ok: false }, { status: 404 });
        const { healthDays, applyHealthDays } = await import("@/lib/health-ingest");
        const body = await readBody(request);
        const days = healthDays(body);
        if (!days.size) return Response.json({ ok: true, updated: 0 });
        const applied = applyHealthDays(payload.dayChecks ?? [], client.id, days);
        if (applied.updated) {
          await saveStudioState({ ...payload, dayChecks: applied.dayChecks });
        }
        return Response.json({ ok: true, updated: applied.updated });
      },
    },
  },
});
