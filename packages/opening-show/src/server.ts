/**
 * @adept-plugins/opening-show — server entry point
 *
 * Registers the opening_show segment: lobby → opening_show → spectator_bet
 */

import type { PluginServerRegistry, MutatorResult, Ctx, Actor } from "@adept/plugin-sdk";
import type { OpeningShowState } from "./state.js";

const PLUGIN_ID = "opening-show";
const SEGMENT_ID = "opening_show";
const NEXT_PHASE = { kind: "plugin_segment", pluginId: "spectator-bet", id: "spectator_bet" } as const;
/** Must match Node-Script emoji line count (40). */
const EMOJI_REVEAL_MAX = 40;

function getState(ctx: Ctx): OpeningShowState {
  return (ctx.snapshot.segmentState[SEGMENT_ID] ?? {
    emojiLineIndex: -1,
    spectatorCorrectCounts: {},
  }) as OpeningShowState;
}

function assertActive(ctx: Ctx): MutatorResult | null {
  if (
    ctx.snapshot.phase.kind !== "plugin_segment" ||
    ctx.snapshot.phase.pluginId !== PLUGIN_ID ||
    ctx.snapshot.phase.id !== SEGMENT_ID
  ) {
    return { ok: false, error: "Opening show is not active" };
  }
  return null;
}

function onEvent(event: string, payload: unknown, actor: Actor, ctx: Ctx): MutatorResult {
  const activeErr = assertActive(ctx);
  if (activeErr) return activeErr;

  if (event === "mark_correct") {
    if (actor.role !== "host") return { ok: false, error: "Host only" };
    if (!payload || typeof payload !== "object") return { ok: false, error: "Invalid payload" };
    const nick = String((payload as Record<string, unknown>)["spectatorKey"] ?? "")
      .trim()
      .slice(0, 64);
    if (!nick) return { ok: false, error: "spectatorKey required" };

    const state = getState(ctx);
    state.spectatorCorrectCounts[nick] = (state.spectatorCorrectCounts[nick] ?? 0) + 1;
    ctx.setSegmentState(SEGMENT_ID, state);
    return { ok: true };
  }

  if (event === "set_correct_count") {
    if (actor.role !== "host") return { ok: false, error: "Host only" };
    if (!payload || typeof payload !== "object") return { ok: false, error: "Invalid payload" };
    const nick = String((payload as Record<string, unknown>)["spectatorKey"] ?? "")
      .trim()
      .slice(0, 64);
    const raw = (payload as Record<string, unknown>)["count"];
    const countNum = typeof raw === "number" ? raw : Number(raw);
    if (!nick) return { ok: false, error: "spectatorKey required" };
    if (!Number.isFinite(countNum)) return { ok: false, error: "count must be a number" };

    const state = getState(ctx);
    const n = Math.max(0, Math.min(9999, Math.floor(countNum)));
    if (n === 0) delete state.spectatorCorrectCounts[nick];
    else state.spectatorCorrectCounts[nick] = n;
    ctx.setSegmentState(SEGMENT_ID, state);
    return { ok: true };
  }

  if (event === "next_emoji") {
    if (actor.role !== "host") return { ok: false, error: "Host only" };
    const state = getState(ctx);
    if (state.emojiLineIndex >= EMOJI_REVEAL_MAX - 1) return { ok: false, error: "emoji line at max" };
    ctx.setSegmentState(SEGMENT_ID, { ...state, emojiLineIndex: state.emojiLineIndex + 1 });
    return { ok: true };
  }

  if (event === "prev_emoji") {
    if (actor.role !== "host") return { ok: false, error: "Host only" };
    const state = getState(ctx);
    if (state.emojiLineIndex <= -1) return { ok: false, error: "emoji line at min" };
    ctx.setSegmentState(SEGMENT_ID, { ...state, emojiLineIndex: state.emojiLineIndex - 1 });
    return { ok: true };
  }

  if (event === "start_bets") {
    if (actor.role !== "host") return { ok: false, error: "Host only" };
    return ctx.requestTransition(NEXT_PHASE);
  }

  return { ok: false, error: `Unknown event: ${event}` };
}

export function registerServer(registry: PluginServerRegistry): void {
  registry.registerSegment({
    pluginId: PLUGIN_ID,
    id: SEGMENT_ID,
    fromPhaseKey: "lobby",
    toPhaseKey: "plugin_segment:spectator-bet:spectator_bet",
    onEvent,
  });
}

