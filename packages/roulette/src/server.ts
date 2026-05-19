/**
 * @adept-plugins/roulette — server entry
 *
 * Pandora card (`pandora`, `replace_field`): on answer reveal the card closes and
 * roulette state moves to `segmentState.pandora_roulette_overlay` (like the wheel).
 */

import type {
  ActiveCard,
  Actor,
  CardCtx,
  MutatorResult,
  PluginServerRegistry,
  SessionSnapshot,
} from "@adept/plugin-sdk";
import type { RoundIndex } from "@adept/plugin-sdk";
import { PANDORA_OVERLAY_SEGMENT_KEY } from "./constants.js";
import { demoteSeatToSpectator } from "./roster.js";
import {
  CARD_KIND,
  PLUGIN_ID,
  initialRouletteState,
  normSeat,
  parseRouletteState,
  type PandoraOverlayAnchor,
  type PandoraOverlaySegment,
  type RoulettePluginState,
} from "./state.js";

const SPIN_MS = 1700;
const CHAMBERS = 6;

function requireCardState(ctx: CardCtx): RoulettePluginState | { error: string } {
  const st = parseRouletteState(ctx.pluginState);
  if (!st) return { error: "Roulette is not initialized" };
  return st;
}

function saveCardState(ctx: CardCtx, st: RoulettePluginState): void {
  ctx.setPluginState(st);
}

export function getPandoraOverlay(snap: SessionSnapshot): PandoraOverlaySegment | null {
  const raw = snap.segmentState[PANDORA_OVERLAY_SEGMENT_KEY];
  if (!raw || typeof raw !== "object" || !("anchor" in raw)) return null;
  const st = parseRouletteState(raw);
  if (!st || !st.fieldVisible) return null;
  return { ...st, anchor: (raw as PandoraOverlaySegment).anchor };
}

function setPandoraOverlay(snap: SessionSnapshot, next: PandoraOverlaySegment | null): void {
  if (next == null) {
    delete snap.segmentState[PANDORA_OVERLAY_SEGMENT_KEY];
  } else {
    snap.segmentState[PANDORA_OVERLAY_SEGMENT_KEY] = next;
  }
}

function anchorFromActive(active: ActiveCard): PandoraOverlayAnchor {
  return active.board === "finalTransition"
    ? { board: "finalTransition", rowIndex: active.rowIndex, colIndex: active.colIndex }
    : {
        board: "round",
        roundIndex: active.roundIndex!,
        rowIndex: active.rowIndex,
        colIndex: active.colIndex,
      };
}

function actorSeatIndex(actor: Actor, snap: SessionSnapshot): number | null {
  if (actor.role !== "player") return null;
  const me = actor.displayName.trim().toLowerCase();
  if (!me) return null;
  for (let i = 0; i < 5; i++) {
    const slot = (snap.seatNames[i] ?? "").trim().toLowerCase();
    if (slot && me === slot) return i;
  }
  return null;
}

function isSeatPlayerOnline(snap: SessionSnapshot, seatIndex: number): boolean {
  const nick = (snap.seatNames[normSeat(seatIndex)] ?? "").trim().toLowerCase();
  if (!nick) return false;
  const online = new Set(snap.onlineParticipantIds);
  for (const p of snap.participants) {
    if (p.displayName.trim().toLowerCase() !== nick) continue;
    return online.has(p.id);
  }
  return false;
}

/** Seated player on turn, or host only when that seat's player is not online (proxy). */
function isCurrentTurnActor(actor: Actor, snap: SessionSnapshot, turnSeat: number): boolean {
  const turn = normSeat(turnSeat);
  const seat = actorSeatIndex(actor, snap);
  if (seat !== null && seat === turn) return true;
  if (actor.role !== "host") return false;
  return !isSeatPlayerOnline(snap, turn);
}

function nextOccupiedSeat(snap: SessionSnapshot, from: number): number {
  for (let i = 1; i <= 5; i++) {
    const idx = normSeat(from + i);
    if ((snap.seatNames[idx] ?? "").trim()) return idx;
  }
  return normSeat(from);
}

function resetLotteryPool(snap: SessionSnapshot): void {
  snap.lottery = { candidates: [], optOut: {}, lastWinnerNick: null };
}

function incrementMiniRoulettePlays(snap: SessionSnapshot): void {
  const ext = snap as SessionSnapshot & {
    miniRoulettePlaysByRound?: Record<RoundIndex, number>;
  };
  if (!ext.miniRoulettePlaysByRound) {
    ext.miniRoulettePlaysByRound = { 1: 0, 2: 0, 3: 0 };
  }
  const ri = currentRoundIndex(snap);
  if (ri) {
    ext.miniRoulettePlaysByRound[ri] = (ext.miniRoulettePlaysByRound[ri] ?? 0) + 1;
  }
}

function currentRoundIndex(snap: SessionSnapshot): RoundIndex | null {
  if (snap.phase.kind === "round") return snap.phase.roundIndex;
  const active = snap.activeCard;
  if (active?.board === "round" && active.roundIndex) return active.roundIndex;
  const ov = getPandoraOverlay(snap);
  if (ov?.anchor.board === "round") return ov.anchor.roundIndex;
  return null;
}

function enterLotteryPhase(snap: SessionSnapshot, st: RoulettePluginState, elimSeat: number): void {
  st.gameOver = true;
  st.eliminatedSeat = elimSeat;
  st.freedSeat = elimSeat;
  st.flowPhase = "lottery";
  st.isSpinning = false;
  st.spinStartedAtMs = null;
  st.bulletPos = -1;
  demoteSeatToSpectator(snap, elimSeat);
  resetLotteryPool(snap);
}

function clearSpinIfElapsed(st: RoulettePluginState): void {
  if (!st.isSpinning) return;
  const started = st.spinStartedAtMs;
  if (started != null && Date.now() - started >= SPIN_MS) {
    st.isSpinning = false;
    st.spinStartedAtMs = null;
  }
}

function applyRouletteEvent(
  snap: SessionSnapshot,
  ov: PandoraOverlaySegment,
  event: string,
  actor: Actor,
): MutatorResult {
  let st: RoulettePluginState = { ...ov };

  if (st.flowPhase === "done") {
    return { ok: false, error: "Roulette flow is finished" };
  }

  if (event === "spin") {
    if (st.flowPhase !== "roulette") return { ok: false, error: "Not in roulette phase" };
    if (st.gameOver) return { ok: false, error: "Game is over" };
    if (!isCurrentTurnActor(actor, snap, st.currentTurnSeat)) {
      return { ok: false, error: "Not your turn" };
    }
    if (st.isSpinning) return { ok: false, error: "Already spinning" };

    st.isSpinning = true;
    st.spinStartedAtMs = Date.now();
    st.bulletPos = Math.floor(Math.random() * CHAMBERS);
    st.chamberPos = 0;
    st.spinSeq += 1;
    setPandoraOverlay(snap, { ...ov, ...st });
    return { ok: true };
  }

  if (event === "spin_complete") {
    if (st.flowPhase !== "roulette") return { ok: false, error: "Not in roulette phase" };
    if (!st.isSpinning) return { ok: true };
    if (!isCurrentTurnActor(actor, snap, st.currentTurnSeat)) {
      return { ok: false, error: "Not your turn" };
    }
    st.isSpinning = false;
    st.spinStartedAtMs = null;
    setPandoraOverlay(snap, { ...ov, ...st });
    return { ok: true };
  }

  if (event === "shoot") {
    if (st.flowPhase !== "roulette") return { ok: false, error: "Not in roulette phase" };
    if (st.gameOver) return { ok: false, error: "Game is over" };
    if (!isCurrentTurnActor(actor, snap, st.currentTurnSeat)) {
      return { ok: false, error: "Not your turn" };
    }
    clearSpinIfElapsed(st);
    if (st.isSpinning) return { ok: false, error: "Wait for spin to finish" };
    if (st.bulletPos < 0) return { ok: false, error: "Spin the cylinder first" };

    const shooter = normSeat(st.currentTurnSeat);
    const isBang = st.chamberPos === st.bulletPos;

    if (isBang) {
      enterLotteryPhase(snap, st, shooter);
      setPandoraOverlay(snap, { ...ov, ...st });
      return { ok: true };
    }

    st.chamberPos = (st.chamberPos + 1) % CHAMBERS;
    const turns = [...st.turnsBySeat] as RoulettePluginState["turnsBySeat"];
    turns[shooter] = Math.min(999, turns[shooter] + 1);
    st.turnsBySeat = turns;
    st.currentTurnSeat = nextOccupiedSeat(snap, shooter);
    st.bulletPos = -1;
    setPandoraOverlay(snap, { ...ov, ...st });
    return { ok: true };
  }

  if (event === "advance_turn") {
    if (actor.role !== "host") return { ok: false, error: "Host only" };
    if (st.flowPhase !== "roulette" || st.gameOver) {
      return { ok: false, error: "Cannot advance turn now" };
    }
    clearSpinIfElapsed(st);
    st.bulletPos = -1;
    st.isSpinning = false;
    st.spinStartedAtMs = null;
    st.currentTurnSeat = nextOccupiedSeat(snap, st.currentTurnSeat);
    setPandoraOverlay(snap, { ...ov, ...st });
    return { ok: true };
  }

  if (event === "finish_lottery") {
    if (actor.role !== "host") return { ok: false, error: "Host only" };
    setPandoraOverlay(snap, null);
    return { ok: true };
  }

  if (event === "close_roulette_field") {
    if (actor.role !== "host") return { ok: false, error: "Host only" };
    setPandoraOverlay(snap, null);
    return { ok: true };
  }

  return { ok: false, error: `Unknown event: ${event}` };
}

/** While the Pandora overlay is open (`activeCard` is null), roulette events are handled here. */
export function handlePandoraOverlayPluginEvent(
  snap: SessionSnapshot,
  event: string,
  _payload: unknown,
  actor: Actor,
): MutatorResult {
  const ov = getPandoraOverlay(snap);
  if (!ov) return { ok: false, error: "Roulette is not open" };
  return applyRouletteEvent(snap, ov, event, actor);
}

function onOpen(ctx: CardCtx): MutatorResult {
  const snap = ctx.snapshot as SessionSnapshot;
  const turn = normSeat(snap.currentTurnSeat);
  const st = initialRouletteState(turn);
  saveCardState(ctx, st);
  resetLotteryPool(snap);
  return { ok: true };
}

function onAdvance(to: "answer", ctx: CardCtx): MutatorResult {
  if (to !== "answer") return { ok: true };
  const snap = ctx.snapshot as SessionSnapshot;
  const active = snap.activeCard;
  if (!active?.cardKinds.includes(CARD_KIND)) return { ok: true };

  const parsed = requireCardState(ctx);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  if (parsed.fieldVisible) return { ok: true };

  const st: RoulettePluginState = { ...parsed, fieldVisible: true };
  const overlay: PandoraOverlaySegment = {
    ...st,
    anchor: anchorFromActive(active),
  };
  snap.segmentState[PANDORA_OVERLAY_SEGMENT_KEY] = overlay;
  incrementMiniRoulettePlays(snap);

  return ctx.closeCard("revealed");
}

function onCardEvent(
  event: string,
  _payload: unknown,
  actor: Actor,
  ctx: CardCtx,
): MutatorResult {
  const snap = ctx.snapshot as SessionSnapshot;
  const parsed = requireCardState(ctx);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  if (!parsed.fieldVisible) {
    return { ok: false, error: "Reveal the answer first" };
  }
  const active = snap.activeCard;
  if (!active) return { ok: false, error: "No active card" };
  const ov: PandoraOverlaySegment = {
    ...parsed,
    anchor: anchorFromActive(active),
  };
  return applyRouletteEvent(snap, ov, event, actor);
}

/** Read freed seat from Pandora overlay (for `lottery_confirm_seat`). */
export function peekPandoraFreedSeat(snap: SessionSnapshot): number | null {
  const ov = getPandoraOverlay(snap);
  if (ov != null && ov.freedSeat !== null) return ov.freedSeat;

  const active = snap.activeCard;
  if (!active?.cardKinds.includes(CARD_KIND)) return null;
  const st = parseRouletteState(active.pluginState[CARD_KIND]);
  if (!st || st.freedSeat === null) return null;
  return st.freedSeat;
}

/** After lottery seat confirm — close roulette overlay and return to the quiz board. */
export function markPandoraLotterySeated(snap: SessionSnapshot): void {
  setPandoraOverlay(snap, null);
}

export function registerServer(registry: PluginServerRegistry): void {
  registry.registerCardKind({
    pluginId: PLUGIN_ID,
    cardKind: CARD_KIND,
    mode: "replace_field",
    validateParams(raw: unknown): MutatorResult | { ok: true; value: unknown } {
      if (raw === undefined || raw === null) return { ok: true, value: {} };
      if (typeof raw !== "object") return { ok: false, error: "pandora cardParams must be an object" };
      return { ok: true, value: { ...raw } };
    },
    onOpen,
    onAdvance,
    onCardEvent,
  });
}

export { CARD_KIND, PLUGIN_ID, parseRouletteState, PANDORA_OVERLAY_SEGMENT_KEY };
export { demoteSeatToSpectator, promoteSpectatorToSeat } from "./roster.js";
