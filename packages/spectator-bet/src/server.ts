/**
 * @adept-plugins/spectator-bet — server entry point
 *
 * Registers the spectator_bet segment: lobby → spectator_picks → round:1
 *
 * Supported host plugin_actions (host-only, sent via `plugin_action` WS message):
 *   "lock_bets"   — lock spectator picks and advance to round:1
 */

import type { PluginServerRegistry, MutatorResult, Ctx } from "@adept/plugin-sdk";

const PLUGIN_ID = "spectator-bet";
const SEGMENT_ID = "spectator_bet";

function onAction(action: string, _payload: unknown, ctx: Ctx): MutatorResult {
  if (action === "lock_bets") {
    // Lock bets and transition to round:1
    const state = (ctx.snapshot.segmentState[SEGMENT_ID] ?? { locked: false, bets: {} }) as {
      locked: boolean;
      bets: Record<string, 1 | 2 | 3 | 4 | 5>;
    };
    ctx.setSegmentState(SEGMENT_ID, { ...state, locked: true });
    return ctx.requestTransition({ kind: "round", roundIndex: 1 });
  }
  return { ok: false, error: `Unknown action: ${action}` };
}

export function registerServer(registry: PluginServerRegistry): void {
  registry.registerSegment({
    pluginId: PLUGIN_ID,
    id: SEGMENT_ID,
    fromPhaseKey: "lobby",
    toPhaseKey: "round:1",
    onAction,
  });
}
