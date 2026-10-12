import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { verifyTelegramInitData } from "@/lib/telegram-auth.server";
import { suggestProgression, type SessionResultInput } from "./engine";
import { canDecideProgression, canSuggestProgression, type Role } from "@/lib/access/stage1-rules";
import { applyPainBlock, painBlocksProgression } from "./pain-block.ts";

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
    // права решаются по сессии и состоянию тренера, а не по coachId из тела запроса
    const isMainTrainer = session.role === "trainer";
    let coachActive = false;
    if (!isMainTrainer) {
      const { loadStudioState } = await import("@/lib/studio-sync");
      const { coachPhase } = await import("@/data/studio");
      const state = await loadStudioState();
      const row = (state.coaches ?? []).find((c) => c.telegramId === session.user.id);
      const phase = row ? coachPhase(row) : "expired";
      coachActive = phase === "trial" || phase === "paid";
    }
    if (!canSuggestProgression({ isMainTrainer, actorId: session.user.id, requestedCoachId: data.coachId, coachActive })) {
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

    // боль в чек-ине за последние 7 дней блокирует повышение нагрузки
    const { loadStudioState: loadForPain } = await import("@/lib/studio-sync");
    const { studioToday } = await import("@/lib/minsk-time");
    const painState = await loadForPain();
    const checks = (painState.dayChecks ?? []).filter((c) => c.clientId === data.clientId);
    const suggestion = applyPainBlock(suggestProgression(results), painBlocksProgression(checks, studioToday()));
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
       values ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8)`,
      [
        id,
        programId,
        data.clientId,
        data.coachId,
        JSON.stringify(suggestion.basedOnResultIds),
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
    // право решить — по правилу stage1: главный тренер — по любому предложению, добавленный — только своему
    const isMainTrainer = session.role === "trainer";
    let coachActive = true;
    if (!isMainTrainer) {
      const { loadStudioState } = await import("@/lib/studio-sync");
      const { coachPhase } = await import("@/data/studio");
      const state = await loadStudioState();
      const coach = (state.coaches ?? []).find((c) => c.telegramId === session.user.id);
      const phase = coach ? coachPhase(coach) : "expired";
      coachActive = phase === "trial" || phase === "paid";
    }
    const decider: Role = isMainTrainer ? "admin" : "trainer";
    if (!coachActive || !canDecideProgression(decider, session.user.id, row[0].coach_id)) {
      return { ok: false as const, reason: "forbidden" };
    }
    if (row[0].status !== "pending" && row[0].status !== "insufficient_data") {
      return { ok: false as const, reason: "already-resolved" };
    }

    const status =
      data.decision === "accept" ? "accepted" : data.decision === "reject" ? "rejected" : "manual";

    // Одна транзакция на одном соединении: BEGIN/COMMIT через пул могли попасть на разные соединения.
    await sql.transaction(async (tx) => {
      await tx.query(
        `update progression_suggestions
         set status = $2, resolved_at = now(), resolved_by = $3
         where id = $1`,
        [data.suggestionId, status, session.user.id],
      );
      await tx.query(
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
    });

    return { ok: true as const, status };
  });
