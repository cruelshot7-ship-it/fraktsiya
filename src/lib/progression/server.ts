import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { verifyTelegramInitData } from "@/lib/telegram-auth.server";
import { suggestProgression, type SessionResultInput } from "./engine";

const SuggestInput = z.object({
  initData: z.string().optional(),
  programId: z.string().min(1),
  clientId: z.string().min(1),
  coachId: z.string().min(1),
});

export const suggestProgressionFn = createServerFn({ method: "POST" })
  .validator(SuggestInput)
  .handler(async ({ data }) => {
    const session = verifyTelegramInitData(data.initData);
    if (!session) return { ok: false as const, reason: "no-telegram" };
    if (session.role !== "trainer" && session.user.id !== data.coachId) {
      return { ok: false as const, reason: "forbidden" };
    }

    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql.query<{
      id: string;
      recorded_at: string;
      sets: SessionResultInput["sets"];
      rpe: number | null;
    }>(
      `select id, recorded_at::text as recorded_at, sets, rpe
       from session_results
       where client_id = $1 and coach_id = $2
       order by recorded_at asc
       limit 20`,
      [data.clientId, data.coachId],
    );

    const results: SessionResultInput[] = rows.map((r) => ({
      id: r.id,
      recordedAt: r.recorded_at,
      sets: (r.sets as SessionResultInput["sets"]) ?? [],
      rpe: r.rpe,
    }));

    const suggestion = suggestProgression(results);
    const id = `psug_${data.programId}_${Date.now()}`;

    await sql.query(
      `insert into client_programs (id, coach_id, client_id, title, version, exercises, active)
       values ($1, $2, $3, $4, 1, '[]'::jsonb, true)
       on conflict (id) do nothing`,
      [data.programId, data.coachId, data.clientId, "Программа"],
    );
    await sql.query(
      `insert into client_programs (id, coach_id, client_id, title, version, exercises, active)
       values ($1, $2, $3, $4, 1, '[]'::jsonb, true)
       on conflict (coach_id, client_id, version) do nothing`,
      [data.programId, data.coachId, data.clientId, "Программа"],
    );
    const programRow = await sql.query<{ id: string }>(
      `select id from client_programs
       where (id = $1) or (coach_id = $2 and client_id = $3 and active = true)
       order by version desc limit 1`,
      [data.programId, data.coachId, data.clientId],
    );
    const programId = programRow[0]?.id ?? data.programId;

    await sql.query(
      `insert into progression_suggestions
        (id, program_id, client_id, coach_id, based_on_result_ids, explanation, proposed_change, status)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
      [
        id,
        programId,
        data.clientId,
        data.coachId,
        suggestion.basedOnResultIds,
        suggestion.explanation,
        JSON.stringify({ changes: suggestion.proposedChanges }),
        suggestion.status === "pending" ? "pending" : "insufficient_data",
      ],
    );

    return { ok: true as const, suggestionId: id, suggestion };
  });

const DecideInput = z.object({
  initData: z.string().optional(),
  suggestionId: z.string().min(1),
  decision: z.enum(["accept", "reject", "manual"]),
  note: z.string().max(2000).optional(),
  manualChange: z.any().optional(),
});

export const decideProgressionFn = createServerFn({ method: "POST" })
  .validator(DecideInput)
  .handler(async ({ data }) => {
    const session = verifyTelegramInitData(data.initData);
    if (!session) return { ok: false as const, reason: "no-telegram" };

    const { getSql } = await import("@/lib/db");
    const sql = await getSql();

    const row = await sql.query<{ id: string; coach_id: string; status: string; program_id: string }>(
      `select id, coach_id, status, program_id from progression_suggestions where id = $1`,
      [data.suggestionId],
    );
    if (!row[0]) return { ok: false as const, reason: "missing" };
    if (row[0].coach_id !== session.user.id && session.role !== "trainer") {
      return { ok: false as const, reason: "forbidden" };
    }
    if (row[0].status !== "pending" && row[0].status !== "insufficient_data") {
      return { ok: false as const, reason: "already-resolved" };
    }

    const status =
      data.decision === "accept" ? "accepted" : data.decision === "reject" ? "rejected" : "manual";

    await sql.query("begin");
    try {
      await sql.query(
        `update progression_suggestions
         set status = $2, resolved_at = now(), resolved_by = $3
         where id = $1`,
        [data.suggestionId, status, session.user.id],
      );
      await sql.query(
        `insert into trainer_decisions
          (id, suggestion_id, decision, decided_by, note, manual_change)
         values ($1, $2, $3, $4, $5, $6::jsonb)`,
        [
          `td_${data.suggestionId}`,
          data.suggestionId,
          data.decision,
          session.user.id,
          data.note ?? null,
          data.manualChange ? JSON.stringify(data.manualChange) : null,
        ],
      );
      await sql.query("commit");
    } catch (e) {
      await sql.query("rollback");
      throw e;
    }

    return { ok: true as const, status };
  });
