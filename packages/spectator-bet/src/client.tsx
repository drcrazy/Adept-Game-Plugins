/**
 * @adept-plugins/spectator-bet — client entry point
 *
 * Registers a React segment view for spectator_bet.
 * Spectators and players see a seat-picker; the host sees a lock button and a table of picks.
 */

import type { CSSProperties } from "react";
import type { PluginClientRegistry, Role, SegmentViewProps, SessionSnapshot, Participant } from "@adept/plugin-sdk";
import type { SpectatorBetState } from "./state.js";

const PLUGIN_ID = "spectator-bet";
const SEGMENT_ID = "spectator_bet";

const MAIN_FONT =
  'Arial, "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", system-ui, sans-serif';

/** Same border + shadow as the segment’s outer gold frame — applied to the bettor’s chosen seat button. */
const MAIN_AREA_GOLD_FRAME: CSSProperties = {
  border: "1px solid rgba(234, 179, 8, 0.45)",
  boxShadow:
    "0 0 20px rgba(234,179,8,0.22), 0 0 48px rgba(250,204,21,0.12), inset 0 0 24px rgba(234,179,8,0.06)",
};

function getState(snapshot: SessionSnapshot): SpectatorBetState {
  return (snapshot.segmentState[SEGMENT_ID] ?? { locked: false, bets: {} }) as SpectatorBetState;
}

/** Seat indices in bets/API are 1–5; `seatNames` is indexed 0–4. */
function displaySeatName(snapshot: SessionSnapshot, seat: 1 | 2 | 3 | 4 | 5): string {
  const raw = snapshot.seatNames[seat - 1]?.trim();
  return raw ? raw : `Игрок ${seat}`;
}

function displayNameForParticipant(snapshot: SessionSnapshot, participantId: string): string {
  const p = snapshot.participants.find((x: Participant) => x.id === participantId);
  if (p?.displayName?.trim()) return p.displayName.trim();
  return participantId.length > 10 ? `${participantId.slice(0, 6)}…` : participantId;
}

type BetRow = { participantId: string; displayName: string; seat: 1 | 2 | 3 | 4 | 5 };

function sortedBetRows(snapshot: SessionSnapshot, bets: SpectatorBetState["bets"]): BetRow[] {
  const rows: BetRow[] = Object.entries(bets).map(([participantId, seat]) => ({
    participantId,
    displayName: displayNameForParticipant(snapshot, participantId),
    seat,
  }));
  rows.sort((a, b) => {
    if (a.seat !== b.seat) return a.seat - b.seat;
    return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" });
  });
  return rows;
}

function HostBetsTable({
  snapshot,
  bets,
}: {
  snapshot: SessionSnapshot;
  bets: SpectatorBetState["bets"];
}) {
  const rows = sortedBetRows(snapshot, bets);
  const tableStyle: CSSProperties = {
    width: "100%",
    maxWidth: 560,
    borderCollapse: "collapse",
    fontSize: "0.9rem",
    color: "#e8eef6",
  };
  const thtd: CSSProperties = {
    border: "1px solid #2a3142",
    padding: "8px 10px",
    textAlign: "left",
  };

  if (rows.length === 0) {
    return (
      <p style={{ margin: 0, color: "#9aa3b2", fontSize: "0.95rem" }}>Ставок пока нет.</p>
    );
  }

  return (
    <table style={tableStyle}>
      <caption style={{ captionSide: "top", paddingBottom: 8, color: "#9aa3b2", textAlign: "left" }}>
        Кто на кого поставил
      </caption>
      <thead>
        <tr>
          <th style={{ ...thtd, color: "#cbd5e1" }}>Участник</th>
          <th style={{ ...thtd, color: "#cbd5e1" }}>Выбор (место)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.participantId}>
            <td style={thtd}>{r.displayName}</td>
            <td style={thtd}>{displaySeatName(snapshot, r.seat)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SpectatorBetView({
  snapshot,
  pluginId,
  segmentId,
  role,
  send,
  participantId,
}: SegmentViewProps & { role: Role }) {
  const state = getState(snapshot);
  const seatCount = 5 as const;
  const canBet = role === "spectator" || role === "player";
  const mySeat = canBet ? state.bets[participantId] : undefined;

  const seatBtnStyle: CSSProperties = {
    padding: "8px 16px",
    background: "#1a2130",
    border: "1px solid #2a3142",
    borderRadius: 8,
    color: "#e8eef6",
    cursor: "pointer",
  };

  const hostPrimaryBtnStyle: CSSProperties = {
    ...seatBtnStyle,
    padding: "10px 22px",
    border: "1px solid rgba(234, 179, 8, 0.45)",
    fontWeight: 600,
    width: "100%",
    maxWidth: 420,
    boxSizing: "border-box",
  };

  const betCount = Object.keys(state.bets).length;

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        overflow: "auto",
        boxSizing: "border-box",
      }}>
      <div
        style={{
          width: "100%",
          maxWidth: 980,
          padding: 16,
          background: "transparent",
          borderRadius: 10,
          boxSizing: "border-box",
        }}>
        <div
          style={{
            borderRadius: 18,
            ...MAIN_AREA_GOLD_FRAME,
            padding: 18,
            minHeight: 260,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            gap: 16,
            background: "transparent",
            fontFamily: MAIN_FONT,
          }}>
          {state.locked ? (
            <>
              <p style={{ margin: 0, color: "#9aa3b2", lineHeight: 1.5, maxWidth: 520 }}>
                Ставки закрыты. Зафиксировано: {betCount} ставок.
              </p>
              {canBet && mySeat != null ? (
                <div
                  style={{
                    padding: "12px 20px",
                    borderRadius: 18,
                    background: "#1a2130",
                    ...MAIN_AREA_GOLD_FRAME,
                    color: "#fef3c7",
                    fontWeight: 600,
                  }}>
                  Ваш выбор: {displaySeatName(snapshot, mySeat)}
                </div>
              ) : null}
              {role === "host" ? (
                <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
                  <HostBetsTable snapshot={snapshot} bets={state.bets} />
                </div>
              ) : null}
            </>
          ) : (
            <>
              {canBet && (
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    justifyContent: "center",
                  }}>
                  {Array.from({ length: seatCount }, (_, i) => i + 1).map((seat) => {
                    const seatN = seat as 1 | 2 | 3 | 4 | 5;
                    const chosen = mySeat === seatN;
                    const label = displaySeatName(snapshot, seatN);
                    return (
                      <button
                        key={seat}
                        type="button"
                        title={`Игрок ${seat}`}
                        onClick={() =>
                          send("plugin_event", { pluginId, segmentId, event: "place_bet", payload: { seat } })
                        }
                        style={
                          chosen
                            ? { ...seatBtnStyle, ...MAIN_AREA_GOLD_FRAME, borderRadius: 12, color: "#fef3c7" }
                            : seatBtnStyle
                        }
                        aria-pressed={chosen}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}

              {role === "host" && (
                <div
                  style={{
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 14,
                  }}>
                  <HostBetsTable snapshot={snapshot} bets={state.bets} />
                  <button
                    type="button"
                    onClick={() => send("plugin_event", { pluginId, segmentId, event: "lock_bets", payload: null })}
                    style={{ ...hostPrimaryBtnStyle, ...MAIN_AREA_GOLD_FRAME, borderRadius: 12, color: "#fef3c7" }}>
                    Дальше
                  </button>
                  <p style={{ margin: 0, color: "#9aa3b2", fontSize: "0.95rem" }}>Ставок: {betCount}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function registerClient(registry: PluginClientRegistry): void {
  registry.registerSegmentView(PLUGIN_ID, SEGMENT_ID, SpectatorBetView);
}
