import type { SessionSnapshot } from "@adept/plugin-sdk";
import { normSeat } from "./state.js";

/** Clears a seat and demotes the matching participant to spectator (REQ-10.3). */
export function demoteSeatToSpectator(snap: SessionSnapshot, seat: number): string {
  const i = normSeat(seat);
  const name = (snap.seatNames[i] ?? "").trim();
  snap.seatNames[i] = "";
  if (!name) return "";
  const key = name.toLowerCase();
  for (const p of snap.participants) {
    if (p.role === "player" && p.displayName.trim().toLowerCase() === key) {
      p.role = "spectator";
    }
  }
  return name;
}

/** Assigns a spectator nick to a seat and promotes their participant role (REQ-10.4). */
export function promoteSpectatorToSeat(
  snap: SessionSnapshot,
  seat: number,
  winnerNick: string,
): void {
  const i = normSeat(seat);
  const safe = winnerNick.trim().slice(0, 32);
  if (!safe) return;

  const wKey = safe.toLowerCase();
  for (let s = 0; s < 5; s++) {
    if (s === i) continue;
    const other = (snap.seatNames[s] ?? "").trim().toLowerCase();
    if (other.length > 0 && other === wKey) {
      return;
    }
  }

  snap.seatNames[i] = safe;
  for (const p of snap.participants) {
    if (p.displayName.trim().toLowerCase() === wKey) {
      p.role = "player";
    }
  }
  snap.scores[i] = 0;
}
