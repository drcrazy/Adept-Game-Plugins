/**
 * @adept-plugins/spectator-bet — client entry point
 *
 * Registers a React segment view for spectator_bet.
 * Spectators see a seat-picker; the host sees a lock button.
 */

import type { PluginClientRegistry, SegmentViewProps, SessionSnapshot } from "@adept/plugin-sdk";
import type { SpectatorBetState } from "./state.js";

const PLUGIN_ID = "spectator-bet";
const SEGMENT_ID = "spectator_bet";

function getState(snapshot: SessionSnapshot): SpectatorBetState {
  return (snapshot.segmentState[SEGMENT_ID] ?? { locked: false, bets: {} }) as SpectatorBetState;
}

function SpectatorBetView({ snapshot, pluginId, segmentId, role, send }: SegmentViewProps & { role: string }) {
  const state = getState(snapshot);
  const seatCount = 5 as const;
  const betEntries = Object.entries(state.bets) as Array<[string, 1 | 2 | 3 | 4 | 5]>;

  return (
    <div style={{ padding: "16px", background: "#1a1f2e", borderRadius: 8, border: "1px solid #2a3142" }}>
      <h3 style={{ marginTop: 0, color: "#f1c40f" }}>Ставки зрителей</h3>

      {state.locked ? (
        <p style={{ color: "#aaa" }}>Ставки закрыты. Зафиксировано: {Object.keys(state.bets).length} ставок.</p>
      ) : (
        <>
          {role === "spectator" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {Array.from({ length: seatCount }, (_, i) => i + 1).map((seat) => (
                <button
                  key={seat}
                  type="button"
                  onClick={() => send("plugin_event", { pluginId, segmentId, event: "place_bet", payload: { seat } })}
                  style={{ padding: "8px 16px", background: "#2a3142",  border: "1px solid #3a4152", borderRadius: 4, color: "#fff", cursor: "pointer" }}
                >
                  Игрок {seat}
                </button>
              ))}
            </div>
          )}

          {role === "host" && (
            <button
              type="button"
              onClick={() => send("plugin_event", { pluginId, segmentId, event: "lock_bets", payload: null })}
              style={{ padding: "8px 24px", background: "#8e44ad", border: "none", borderRadius: 4, color: "#fff", cursor: "pointer" }}
            >
              Зафиксировать ставки и начать Раунд 1
            </button>
          )}

          <p style={{ color: "#888", fontSize: "0.85rem" }}>
            Ставок: {Object.keys(state.bets).length}
          </p>
        </>
      )}

      <details style={{ marginTop: 12, fontSize: "0.8rem", color: "#888" }}>
        <summary>Все ставки</summary>
        {betEntries.map(([key, seat]) => (
          <div key={key}>
            {key}: Игрок {seat}
          </div>
        ))}
      </details>
    </div>
  );
}

export function registerClient(registry: PluginClientRegistry): void {
  registry.registerSegmentView(PLUGIN_ID, SEGMENT_ID, SpectatorBetView);
}
