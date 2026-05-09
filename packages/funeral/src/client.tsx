/**
 * @adept-plugins/funeral — client entry point
 *
 * Registers React segment views for the funeral transition (REQ-12):
 *   - story_video: passive video playback
 *   - donations:   each player donates a non-negative amount ≤ their score
 */

import { useState } from "react";
import type { PluginClientRegistry, SegmentViewProps } from "@adept/plugin-sdk";
import type { DonationsState } from "./state.js";

const PLUGIN_ID = "funeral";
const STORY_VIDEO_SEGMENT_ID = "story_video";
const DONATIONS_SEGMENT_ID = "donations";

const DONATIONS_STATE_KEY = "donations";

function StoryVideoView(_props: SegmentViewProps) {
  return (
    <div style={{ padding: "16px", background: "#1a1f2e", borderRadius: 8, border: "1px solid #2a3142" }}>
      <h3 style={{ marginTop: 0 }}>Сюжет</h3>
      <p style={{ color: "#aaa" }}>Воспроизводится сюжетный ролик…</p>
    </div>
  );
}

function StoryVideoRailView(_props: SegmentViewProps) {
  return (
    <div className="card">
      <h4 style={{ marginTop: 0 }}>Сюжет</h4>
      <p style={{ color: "#aaa", marginBottom: 0 }}>Переходный сегмент.</p>
    </div>
  );
}

function DonationsView({ snapshot, send, role, pluginId, segmentId }: SegmentViewProps & { role: string }) {
  const [donSeat, setDonSeat] = useState(0);
  const [donAmount, setDonAmount] = useState(0);

  const state = (snapshot.segmentState[DONATIONS_STATE_KEY] ?? {
    bySeat: [null, null, null, null, null],
  }) as DonationsState;

  return (
    <div style={{ padding: "16px", background: "#1a1f2e", borderRadius: 8, border: "1px solid #2a3142" }}>
      <h3 style={{ marginTop: 0 }}>Донаты (REQ-12)</h3>

      <div style={{ marginBottom: 12, fontSize: "0.85rem", color: "#aaa" }}>
        {state.bySeat.map((v: number | null, i: number) => (
          <span key={i} style={{ marginRight: 12 }}>
            Игрок {i + 1}: {v ?? "—"}
          </span>
        ))}
      </div>

      {role === "player" ? (
        <div style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ color: "#aaa", fontSize: "0.85rem" }}>Место 0–4</span>
            <input
              type="number"
              min={0}
              max={4}
              value={donSeat}
              onChange={(e) => setDonSeat(Number(e.target.value))}
              style={{ padding: "6px 8px" }}
            />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ color: "#aaa", fontSize: "0.85rem" }}>Сумма</span>
            <input
              type="number"
              min={0}
              value={donAmount}
              onChange={(e) => setDonAmount(Number(e.target.value))}
              style={{ padding: "6px 8px" }}
            />
          </label>
          <button
            type="button"
            onClick={() =>
              send("plugin_event", { pluginId, segmentId, event: "set_donation", payload: { seatIndex: donSeat, amount: donAmount } }) }
              style={{ padding: "8px 16px", background: "#2a3142", border: "1px solid #3a4152", borderRadius: 4, color: "#fff", cursor: "pointer" }}
          >
            Отправить донат
          </button>
        </div>
      ) : (
        <p style={{ color: "#aaa", fontSize: "0.85rem" }}>Ожидание донатов от игроков…</p>
      )}
    </div>
  );
}

function DonationsRailView({ snapshot }: SegmentViewProps) {
  const state = (snapshot.segmentState[DONATIONS_STATE_KEY] ?? {
    bySeat: [null, null, null, null, null],
  }) as DonationsState;
  const doneCount = state.bySeat.filter((v) => v != null).length;
  return (
    <div className="card">
      <h4 style={{ marginTop: 0 }}>Донаты</h4>
      <div style={{ color: "#aaa" }}>Ответов: {doneCount} / 5</div>
    </div>
  );
}

export function registerClient(registry: PluginClientRegistry): void {
  registry.registerSegmentView(PLUGIN_ID, STORY_VIDEO_SEGMENT_ID, StoryVideoView);
  registry.registerSegmentView(PLUGIN_ID, DONATIONS_SEGMENT_ID, DonationsView);
  registry.registerSegmentRailView(PLUGIN_ID, STORY_VIDEO_SEGMENT_ID, StoryVideoRailView);
  registry.registerSegmentRailView(PLUGIN_ID, DONATIONS_SEGMENT_ID, DonationsRailView);
}
