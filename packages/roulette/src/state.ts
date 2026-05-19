import type { RoundIndex } from "@adept/plugin-sdk";

/** Sub-phases while the Pandora card is open (REQ-10). */
export type RouletteFlowPhase = "roulette" | "lottery" | "done";

export type PandoraOverlayAnchor =
  | { board: "round"; roundIndex: RoundIndex; rowIndex: number; colIndex: number }
  | { board: "finalTransition"; rowIndex: number; colIndex: number };

export type RoulettePluginState = {
  /** When false, question modal shows; roulette field appears after host reveals answer. */
  fieldVisible: boolean;
  flowPhase: RouletteFlowPhase;
  /** Roulette turns completed per seat (shown on player cards). */
  turnsBySeat: [number, number, number, number, number];
  currentTurnSeat: number;
  eliminatedSeat: number | null;
  /** Seat freed by elimination; lottery winner fills this seat first. */
  freedSeat: number | null;
  /** -1 = cylinder not loaded after spin. */
  bulletPos: number;
  chamberPos: number;
  isSpinning: boolean;
  spinStartedAtMs: number | null;
  spinSeq: number;
  gameOver: boolean;
};

/** Lives in `snapshot.segmentState[PANDORA_OVERLAY_SEGMENT_KEY]` after host reveals answer. */
export type PandoraOverlaySegment = RoulettePluginState & {
  anchor: PandoraOverlayAnchor;
};

export const CARD_KIND = "pandora" as const;
export const PLUGIN_ID = "roulette" as const;

export function initialRouletteState(initialTurnSeat: number): RoulettePluginState {
  const turn = normSeat(initialTurnSeat);
  return {
    fieldVisible: false,
    flowPhase: "roulette",
    turnsBySeat: [0, 0, 0, 0, 0],
    currentTurnSeat: turn,
    eliminatedSeat: null,
    freedSeat: null,
    bulletPos: -1,
    chamberPos: 0,
    isSpinning: false,
    spinStartedAtMs: null,
    spinSeq: 0,
    gameOver: false,
  };
}

export function parseRouletteState(raw: unknown): RoulettePluginState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const flowPhase = o.flowPhase;
  if (flowPhase !== "roulette" && flowPhase !== "lottery" && flowPhase !== "done") return null;
  const turns = o.turnsBySeat;
  if (!Array.isArray(turns) || turns.length !== 5) return null;
  const turnsBySeat = turns.map((n) =>
    Math.max(0, Math.min(999, Math.floor(Number(n) || 0))),
  ) as [number, number, number, number, number];
  return {
    fieldVisible: o.fieldVisible === true,
    flowPhase,
    turnsBySeat,
    currentTurnSeat: normSeat(Number(o.currentTurnSeat ?? 0)),
    eliminatedSeat:
      o.eliminatedSeat === null || o.eliminatedSeat === undefined
        ? null
        : normSeat(Number(o.eliminatedSeat)),
    freedSeat:
      o.freedSeat === null || o.freedSeat === undefined
        ? null
        : normSeat(Number(o.freedSeat)),
    bulletPos: Number(o.bulletPos ?? -1),
    chamberPos: normChamber(Number(o.chamberPos ?? 0)),
    isSpinning: o.isSpinning === true,
    spinStartedAtMs:
      typeof o.spinStartedAtMs === "number" ? o.spinStartedAtMs : null,
    spinSeq: Math.max(0, Math.floor(Number(o.spinSeq ?? 0))),
    gameOver: o.gameOver === true,
  };
}

export function normSeat(s: number): number {
  return (((Math.floor(s) % 5) + 5) % 5) as 0 | 1 | 2 | 3 | 4;
}

function normChamber(p: number): number {
  return (((Math.floor(p) % 6) + 6) % 6) as 0 | 1 | 2 | 3 | 4 | 5;
}
