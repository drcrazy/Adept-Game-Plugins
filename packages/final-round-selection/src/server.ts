/**
 * @adept-plugins/final-round-selection — server entry point
 *
 * Registers between_final: round:3 → between_final → final
 */

import type { PluginServerRegistry } from "@adept/plugin-sdk";

const PLUGIN_ID = "final-round-selection";
const SEGMENT_ID = "between_final";

export function registerServer(registry: PluginServerRegistry): void {
  registry.registerSegment({
    pluginId: PLUGIN_ID,
    id: SEGMENT_ID,
    fromPhaseKey: "round:3",
    toPhaseKey: "final",
  });
}

