/**
 * @adept-plugins/spectator-bet — server entry point
 *
 * Registers the spectator_bet segment: lobby → spectator_bet → round:1
 */

import type { PluginServerRegistry, MutatorResult, Ctx, Actor } from "@adept/plugin-sdk";
import type { SpectatorBetState } from "./state.js";

const PLUGIN_ID = "spectator-bet";
const SEGMENT_ID = "spectator_bet";

function getState(ctx: Ctx): SpectatorBetState {
  return (ctx.snapshot.segmentState[SEGMENT_ID] ?? { locked: false, bets: {} }) as SpectatorBetState;
}

function onEvent(event: string, payload: unknown, actor: Actor, ctx: Ctx): MutatorResult {
  if (event === "place_bet") {
    if (actor.role !== "spectator") return { ok: false, error: "Spectators only" };
    if (!payload || typeof payload !== "object") return { ok: false, error: "Invalid payload" };
    
    const seat = (payload as Record<string, unknown>)["seat"];
    if (seat !== 1 && seat !== 2 && seat !== 3 && seat !== 4 && seat !== 5) {
      return { ok: false, error: "Invalid seat" };
    }
    if (
      ctx.snapshot.phase.kind !== "plugin_segment" ||
      ctx.snapshot.phase.pluginId !== PLUGIN_ID ||
      ctx.snapshot.phase.id !== SEGMENT_ID
    ) {
      return { ok: false, error: "Spectator bet not open" };
    }

    const state = getState(ctx);
    if (state.locked) return { ok: false, error: "Spectator bets are locked" };
    state.bets[actor.participantId] = seat;
    ctx.setSegmentState(SEGMENT_ID, state);
    return { ok: true };
  }

  if (event === "lock_bets") {
    if (actor.role !== "host") return { ok: false, error: "Host only" };
    const state = getState(ctx);
    ctx.setSegmentState(SEGMENT_ID, { ...state, locked: true });
    return ctx.requestTransition({ kind: "round", roundIndex: 1 });
  }

  return { ok: false, error: `Unknown event: ${event}` };
}

export function registerServer(registry: PluginServerRegistry): void {
  registry.registerSegment({
    pluginId: PLUGIN_ID,
    id: SEGMENT_ID,
    fromPhaseKey: "lobby",
    toPhaseKey: "round:1",
    onEvent,
  });
}
