/**
 * @adept-plugins/funeral — server entry point
 *
 * Implements REQ-12 between-rounds transition as a single plugin with two
 * chained segments:
 *   round:2 → story_video → donations → round:3
 *
 * Both segments share the same outer slot ("after:round:2" → "round:3"); they
 * differ only in which view the host shows. The donations seat data remains
 * keyed under `segmentState["donations"]`.
 */

import type { Actor, Ctx, MutatorResult, PluginServerRegistry } from "@adept/plugin-sdk";

const PLUGIN_ID = "funeral";
const STORY_VIDEO_SEGMENT_ID = "story_video";
const DONATIONS_SEGMENT_ID = "donations";

type DonationsState = {
  bySeat: [number | null, number | null, number | null, number | null, number | null];
};

function getDonationsState(ctx: Ctx): DonationsState {
  return (ctx.snapshot.segmentState[DONATIONS_SEGMENT_ID] ?? {
    bySeat: [null, null, null, null, null],
  }) as DonationsState;
}

function onDonationsEvent(event: string, payload: unknown, actor: Actor, ctx: Ctx): MutatorResult {
  if (event !== "set_donation") return { ok: false, error: `Unknown event: ${event}` };
  if (actor.role !== "player") return { ok: false, error: "Players only" };
  if (!payload || typeof payload !== "object") return { ok: false, error: "Invalid payload" };

  if (
    ctx.snapshot.phase.kind !== "plugin_segment" ||
    ctx.snapshot.phase.pluginId !== PLUGIN_ID ||
    ctx.snapshot.phase.id !== DONATIONS_SEGMENT_ID
  ) {
    return { ok: false, error: "Donations not open" };
  }

  const p = payload as Record<string, unknown>;
  const amount = p["amount"];
  const seatIndex = p["seatIndex"];
  if (typeof seatIndex !== "number" || seatIndex < 0 || seatIndex > 4) {
    return { ok: false, error: "Invalid seatIndex" };
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: "Invalid amount" };
  }

  const score = ctx.snapshot.scores[seatIndex];
  if (amount > score) return { ok: false, error: "Donation exceeds score" };

  const state = getDonationsState(ctx);
  state.bySeat[seatIndex] = amount;
  ctx.setSegmentState(DONATIONS_SEGMENT_ID, state);
  return { ok: true };
}

export function registerServer(registry: PluginServerRegistry): void {
  registry.registerSegment({
    pluginId: PLUGIN_ID,
    id: STORY_VIDEO_SEGMENT_ID,
    fromPhaseKey: "round:2",
    toPhaseKey: `plugin_segment:${PLUGIN_ID}:${DONATIONS_SEGMENT_ID}`,
  });
  registry.registerSegment({
    pluginId: PLUGIN_ID,
    id: DONATIONS_SEGMENT_ID,
    fromPhaseKey: `plugin_segment:${PLUGIN_ID}:${STORY_VIDEO_SEGMENT_ID}`,
    toPhaseKey: "round:3",
    onEvent: onDonationsEvent,
  });
}
