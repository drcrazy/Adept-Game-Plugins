/**
 * @adept-plugins/funeral — server entry point
 *
 * Implements REQ-12 between-rounds transition as a single plugin with two
 * chained segments:
 *   round:2 → story_video → donations → round:3
 *
 * Both segments share the same outer slot ("after:round:2" → "round:3"); they
 * differ only in which view the host shows. The donations seat data remains
 * keyed under `segmentState["donations"]` so the existing `player_donation`
 * server handler continues to find it without renaming.
 */

import type { PluginServerRegistry } from "@adept/plugin-sdk";

const PLUGIN_ID = "funeral";
const STORY_VIDEO_SEGMENT_ID = "story_video";
const DONATIONS_SEGMENT_ID = "donations";

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
  });
}
