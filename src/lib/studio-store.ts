import { create } from "zustand";
import { buildMeasure, mergeMeasures, upsertMeasure, type MeasureInput } from "@/lib/body-measures";
import { activeLogFor, canUndoWorkout, cleanFacts } from "@/lib/workout-undo";
import { anonymizedIdentity, PRIVACY_VERSION, specialDataAllowed } from "@/lib/privacy";
import { applySetMark } from "@/lib/program-blocks";
import { referralRewarded, referralRewardTxn, REFERRAL_REWARD } from "@/lib/referral";
import { trainerSignalText } from "@/lib/day-load-hint";
import { detectPRs } from "@/lib/athlete-metrics";
import type { ProgramTemplate } from "@/lib/templates/program-template";
import { checkMenus, keepClientChoices, menuChoiceLogs, menuKey, menuLogPrefix, pruneMenus, type MenuRecord } from "@/lib/menu-scope";
import {
  BOT_USERNAME,
  addDays,
  DEFAULT_NOTIFY,
  DOW,
  emptyClient,
  buildProgram,
  firstBookableDate,
  applyOfferBooking,
  formatDayMonth,
  formatLongDate,
  hoursAgoIso,
  hoursUntilLabel,
  hoursUntilSlot,
  ARRIVE_WATER,
  isoDate,
  studioToday,
  isFrozen,
  isLateCancel,
  isSlotPast,
  MEALS,
  PACK_VALID_DAYS,
  parseISODate,
  sessionsRu,
  shortName,
  startOfWeek,
  type Booking,
  type Client,
  type FoodLog,
  type DayCheck,
  type JoinRequest,
  type LiftLog,
  type Meal,
  type Notice,
  type NotifyPrefs,
  type SessionTxn,
  type Slot,
  type Visit,
  type WaitlistEntry,
  type WorkoutLog,
  workoutKcal,
  coachKey,
  TRAINER_TG_ID,
  type Coach,
  coachPhase,
  COACH_TRIAL_CAP,
  isTrainDay,
} from "@/data/studio";

import { hapticNotify } from "@/lib/haptics";
import { withArrival } from "@/lib/studio-visits";
import { repeatWeekSlots, weekSourceCounts } from "@/lib/studio-repeat";
import { cancelTxnId } from "@/lib/balance";
import { applyTelegramIdentity, flushCloudPush, hasUnsyncedChanges, scheduleCloudPush, syncFromCloud, telegramLocked } from "@/lib/studio-identity";
import { mergeBookingFlags, unionIds } from "@/lib/studio-merge";
import { COACH_TIERS_TEXT } from "@/lib/coach-tier";
import { addCoachFn, decideJoinFn, dropTombstones, ensureApprovedClients, isRemovedClient, mergeClients, payCoachFn, removeCoachFn, requestJoin, sendBotLinkFn, tombstonesFor } from "@/lib/studio-sync";
import { stripDemoData } from "@/lib/studio-clean";
import { mergeChecks } from "@/lib/checks-merge";
import { getStartParam, getTelegramInitData, getTelegramUser } from "@/lib/telegram";

export type TabId = "today" | "schedule" | "program" | "programs" | "progress" | "more" | "slots" | "bookings" | "food" | "form" | "hall" | "clients" | "signals";
export type Role = "client" | "trainer";
export type ClientFilter = "all" | "attention" | "today" | "empty" | "packSoon" | "lapsed";

// NOTE: full file continues - this is a test
