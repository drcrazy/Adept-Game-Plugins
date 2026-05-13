/**
 * @adept-plugins/raccoon — server entry
 *
 * Card kind `raccoon`: after the splash animation, the host or the player on
 * the current turn may hand the turn to another seat (REQ-5.5).
 */

import type { Actor, CardCtx, MutatorResult, PluginServerRegistry, SessionSnapshot } from "@adept/plugin-sdk";
import type { RaccoonPluginState } from "./state.js";

const PLUGIN_ID = "raccoon";
const CARD_KIND = "raccoon";

function parseState(raw: unknown): RaccoonPluginState {
  if (!raw || typeof raw !== "object") return {};
  return raw as RaccoonPluginState;
}

function isHostOrCurrentTurnPlayer(actor: Actor, snap: SessionSnapshot): boolean {
  if (actor.role === "host") return true;
  if (actor.role !== "player") return false;
  const seat = ((Math.floor(Number(snap.currentTurnSeat)) % 5) + 5) % 5;
  const slotName = (snap.seatNames[seat] ?? "").trim().toLowerCase();
  const me = actor.displayName.trim().toLowerCase();
  return me.length > 0 && slotName.length > 0 && me === slotName;
}

function splashDismissHostOnly(cardParams: unknown): boolean {
  if (!cardParams || typeof cardParams !== "object") return false;
  return (cardParams as Record<string, unknown>)["splashDismissHostOnly"] === true;
}

function canDismissSplash(actor: Actor, snap: SessionSnapshot, cardParams: unknown): boolean {
  if (splashDismissHostOnly(cardParams)) return actor.role === "host";
  return isHostOrCurrentTurnPlayer(actor, snap);
}

function canPassTurn(actor: Actor, snap: SessionSnapshot, cardParams: unknown): boolean {
  if (splashDismissHostOnly(cardParams)) return actor.role === "host";
  return isHostOrCurrentTurnPlayer(actor, snap);
}

function setTurnSeat(snap: SessionSnapshot, seat: number): void {
  const n = ((Math.floor(seat) % 5) + 5) % 5;
  (snap as { currentTurnSeat: number }).currentTurnSeat = n;
}

function onCardEvent(
  event: string,
  payload: unknown,
  actor: Actor,
  ctx: CardCtx,
): MutatorResult {
  const snap = ctx.snapshot as SessionSnapshot;
  const st = parseState(ctx.pluginState);

  if (event === "dismiss_splash") {
    if (!canDismissSplash(actor, snap, ctx.cardParams)) {
      return { ok: false, error: "Not allowed to dismiss splash" };
    }
    if (st.splashDismissed) return { ok: true };
    ctx.setPluginState({ ...st, splashDismissed: true });
    return { ok: true };
  }

  if (event === "set_pass_hover") {
    if (!canPassTurn(actor, snap, ctx.cardParams)) {
      return { ok: false, error: "Not allowed to sync hover" };
    }
    if (!st.splashDismissed) return { ok: false, error: "Splash not dismissed" };
    if (st.seatPassUsed) return { ok: false, error: "Seat pass already used" };
    let seat: number | null = null;
    if (payload !== null && payload !== undefined) {
      if (typeof payload !== "object") return { ok: false, error: "Invalid hover payload" };
      const raw = (payload as Record<string, unknown>)["seat"];
      if (raw !== null) {
        const n = typeof raw === "number" ? raw : Number(raw);
        if (!Number.isInteger(n) || n < 0 || n > 4) return { ok: false, error: "Invalid seat" };
        const turn = ((Math.floor(Number(snap.currentTurnSeat)) % 5) + 5) % 5;
        if (n === turn) return { ok: false, error: "Invalid hover seat" };
        seat = n;
      }
    }
    ctx.setPluginState({ ...st, passHoverSeat: seat });
    return { ok: true };
  }

  if (event === "pass_turn_to_seat") {
    if (!canPassTurn(actor, snap, ctx.cardParams)) {
      return { ok: false, error: "Not allowed to pass turn" };
    }
    if (!st.splashDismissed) return { ok: false, error: "Splash not dismissed" };
    if (st.seatPassUsed) return { ok: false, error: "Seat pass already used" };
    if (!payload || typeof payload !== "object") return { ok: false, error: "Invalid payload" };
    const raw = (payload as Record<string, unknown>)["targetSeat"];
    const t = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isInteger(t) || t < 0 || t > 4) return { ok: false, error: "targetSeat must be 0–4" };
    const turn = ((Math.floor(Number(snap.currentTurnSeat)) % 5) + 5) % 5;
    if (t === turn) return { ok: false, error: "Cannot pass to current seat" };
    setTurnSeat(snap, t);
    ctx.setPluginState({ ...st, seatPassUsed: true, passHoverSeat: null });
    return { ok: true };
  }

  return { ok: false, error: `Unknown event: ${event}` };
}

export function registerServer(registry: PluginServerRegistry): void {
  registry.registerCardKind({
    pluginId: PLUGIN_ID,
    cardKind: CARD_KIND,
    mode: "in_card",
    validateParams(raw: unknown): MutatorResult | { ok: true; value: unknown } {
      if (raw === undefined || raw === null) return { ok: true, value: {} };
      if (typeof raw !== "object") return { ok: false, error: "raccoon cardParams must be an object" };
      const o = raw as Record<string, unknown>;
      if (o.splashUrl !== undefined && typeof o.splashUrl !== "string") {
        return { ok: false, error: "splashUrl must be a string" };
      }
      if (
        o.splashDismissHostOnly !== undefined &&
        typeof o.splashDismissHostOnly !== "boolean"
      ) {
        return { ok: false, error: "splashDismissHostOnly must be boolean" };
      }
      return { ok: true, value: { ...o } };
    },
    onCardEvent,
  });
}
