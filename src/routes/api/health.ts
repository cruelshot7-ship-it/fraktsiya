import { createFileRoute } from "@tanstack/react-router";
import { specialDataAllowed } from "@/lib/privacy";

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
        const { loadStudioState, updateStudioState } = await import("@/lib/studio-sync");
        const payload = await loadStudioState();
        const client = payload.clients.find(
          (row) => (row.healthToken || "").toLowerCase() === token,
        );
        if (!client) return Response.json({ ok: false }, { status: 404 });
        // шаги, сон, вода и активность — данные о здоровье: без согласия клиента не сохраняем
        if (!specialDataAllowed(client.consent)) {
          return Response.json({ ok: false, reason: "consent" }, { status: 403 });
        }
        const { healthDays, applyHealthDays } = await import("@/lib/health-ingest");
        const body = await readBody(request);
        const days = healthDays(body);
        if (!days.size) return Response.json({ ok: true, updated: 0 });
        let updated = 0;
        // запись с повтором при гонке: дневные отметки не теряются и не пишутся поверх чужих
        const outcome = await updateStudioState((current) => {
          const applied = applyHealthDays(current.dayChecks ?? [], client.id, days);
          updated = applied.updated;
          if (!applied.updated) return null;
          return { ...current, dayChecks: applied.dayChecks };
        });
        if (outcome === "conflict") return Response.json({ ok: false, reason: "busy" }, { status: 409 });
        return Response.json({ ok: true, updated });
      },
    },
  },
});
