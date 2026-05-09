/**
 * @adept-plugins/final-round-selection — client entry point
 *
 * Owns the between_final segment UI (transition to Final).
 */

import type { PluginClientRegistry, SegmentViewProps } from "@adept/plugin-sdk";

const PLUGIN_ID = "final-round-selection";
const SEGMENT_ID = "between_final";

function BetweenFinalView(_props: SegmentViewProps) {
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Переход к финалу</h3>
      <p style={{ color: "#aaa" }}>Подготовка к финальному раунду…</p>
    </div>
  );
}

function BetweenFinalRailView(_props: SegmentViewProps) {
  return (
    <div className="card">
      <h4 style={{ marginTop: 0 }}>Финал</h4>
      <p style={{ color: "#aaa", marginBottom: 0 }}>Сегмент подготовки к финалу.</p>
    </div>
  );
}

export function registerClient(registry: PluginClientRegistry): void {
  registry.registerSegmentView(PLUGIN_ID, SEGMENT_ID, BetweenFinalView);
  registry.registerSegmentRailView(PLUGIN_ID, SEGMENT_ID, BetweenFinalRailView);
}

