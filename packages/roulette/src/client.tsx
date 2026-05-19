/**
 * @adept-plugins/roulette — client entry (Pandora replace_field)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { CardFullScreenProps, PluginClientRegistry, SessionSnapshot } from "@adept/plugin-sdk";
import { CYLINDER_SPIN_MS, Cylinder } from "./Cylinder.js";
import { LotteryOverlay } from "./LotteryOverlay.js";
import { PLAYER_COLORS, RoulettePlayerCard } from "./RoulettePlayerCard.js";
import { CARD_KIND, normSeat, parseRouletteState, type RoulettePluginState } from "./state.js";

function viewerSeatIndex(snapshot: SessionSnapshot, participantId: string): number | null {
  const me = snapshot.participants.find((p) => p.id === participantId)?.displayName.trim().toLowerCase();
  if (!me) return null;
  for (let i = 0; i < 5; i++) {
    const slot = (snapshot.seatNames[i] ?? "").trim().toLowerCase();
    if (slot && me === slot) return i;
  }
  return null;
}

function seatOnline(snapshot: SessionSnapshot, seatIndex: number): boolean {
  const nick = (snapshot.seatNames[seatIndex] ?? "").trim().toLowerCase();
  if (!nick) return false;
  const online = new Set(snapshot.onlineParticipantIds);
  for (const p of snapshot.participants) {
    if (p.displayName.trim().toLowerCase() !== nick) continue;
    return online.has(p.id);
  }
  return false;
}

function isSeatPlayerOnline(snapshot: SessionSnapshot, seatIndex: number): boolean {
  const nick = (snapshot.seatNames[normSeat(seatIndex)] ?? "").trim().toLowerCase();
  if (!nick) return false;
  const online = new Set(snapshot.onlineParticipantIds);
  for (const p of snapshot.participants) {
    if (p.displayName.trim().toLowerCase() !== nick) continue;
    return online.has(p.id);
  }
  return false;
}

function canActOnTurn(
  snapshot: SessionSnapshot,
  role: CardFullScreenProps["role"],
  participantId: string,
  turnSeat: number,
): boolean {
  const turn = normSeat(turnSeat);
  const mySeat = viewerSeatIndex(snapshot, participantId);
  if (mySeat !== null && mySeat === turn) return true;
  if (role !== "host") return false;
  return !isSeatPlayerOnline(snapshot, turn);
}

function parseOrDefault(raw: unknown): RoulettePluginState {
  return (
    parseRouletteState(raw) ?? {
      fieldVisible: false,
      flowPhase: "roulette",
      turnsBySeat: [0, 0, 0, 0, 0],
      currentTurnSeat: 0,
      eliminatedSeat: null,
      freedSeat: null,
      bulletPos: -1,
      chamberPos: 0,
      isSpinning: false,
      spinStartedAtMs: null,
      spinSeq: 0,
      gameOver: false,
    }
  );
}

function PandoraFullScreen(props: CardFullScreenProps) {
  const st = parseOrDefault(props.pluginState);
  const prevSpinSeq = useRef(st.spinSeq);
  const spinCompleteSent = useRef(false);
  const [actionPending, setActionPending] = useState<"spin" | "shoot" | null>(null);

  const seatNames = props.snapshot.seatNames;
  const turnSeat = st.currentTurnSeat;
  const turnName = (seatNames[turnSeat] ?? "").trim() || `Игрок ${turnSeat + 1}`;
  const turnColor = PLAYER_COLORS[turnSeat] ?? "#9b59b6";

  const isHost = props.role === "host";
  const canAct =
    st.flowPhase === "roulette" &&
    !st.gameOver &&
    canActOnTurn(props.snapshot, props.role, props.participantId, turnSeat);

  const canSpin = canAct && !st.isSpinning && actionPending !== "spin";
  const canShoot = canAct && !st.isSpinning && st.bulletPos >= 0 && actionPending !== "shoot";

  useEffect(() => {
    setActionPending(null);
  }, [st.spinSeq, st.currentTurnSeat, st.isSpinning]);

  useEffect(() => {
    if (actionPending == null) return undefined;
    const t = window.setTimeout(() => setActionPending(null), 3000);
    return () => window.clearTimeout(t);
  }, [actionPending]);

  const handleSpin = useCallback(() => {
    if (!canAct || st.isSpinning || actionPending === "spin") return;
    setActionPending("spin");
    props.send("spin", {});
  }, [canAct, st.isSpinning, actionPending, props]);

  const handleShoot = useCallback(() => {
    if (!canAct || st.isSpinning || st.bulletPos < 0 || actionPending === "shoot") return;
    setActionPending("shoot");
    props.send("shoot", {});
  }, [canAct, st.isSpinning, st.bulletPos, actionPending, props]);

  useEffect(() => {
    if (st.spinSeq > prevSpinSeq.current) {
      prevSpinSeq.current = st.spinSeq;
      spinCompleteSent.current = false;
    }
  }, [st.spinSeq]);

  useEffect(() => {
    if (!st.isSpinning) return undefined;
    if (spinCompleteSent.current) return undefined;
    const t = window.setTimeout(() => {
      spinCompleteSent.current = true;
      props.send("spin_complete", {});
    }, CYLINDER_SPIN_MS);
    return () => window.clearTimeout(t);
  }, [st.isSpinning, st.spinSeq, props]);

  const qText = props.cell.text?.trim() ?? "";
  const showLottery = st.flowPhase === "lottery";

  return (
    <div
      className="roulette-field"
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        background:
          "radial-gradient(ellipse at 50% 0%, rgba(155,89,182,0.15) 0%, transparent 55%), #1a1a2e",
        color: "#ecf0f1",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          padding: "12px 16px 8px",
          borderBottom: "1px solid rgba(155,89,182,0.35)",
          textAlign: "center",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 11,
            fontFamily: "monospace",
            textTransform: "uppercase",
            letterSpacing: 3,
            color: "#9b59b6",
          }}
        >
          {props.themeName} · {props.pointValue}
        </p>
        <h2
          style={{
            margin: "6px 0 0",
            fontSize: "1.1rem",
            fontWeight: 700,
            color: "#f1c40f",
            letterSpacing: 2,
          }}
        >
          Ящик Пандоры
        </h2>
        {qText ? (
          <p
            style={{
              margin: "8px 0 0",
              fontSize: "0.9rem",
              lineHeight: 1.45,
              opacity: 0.9,
              maxWidth: 640,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            {qText}
          </p>
        ) : null}
      </div>

      <div
        style={{
          flexShrink: 0,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 4,
          padding: "8px 12px",
          zIndex: 10,
        }}
      >
        {([0, 1, 2, 3, 4] as const).map((i) => {
          const name = (seatNames[i] ?? "").trim();
          const eliminated = st.eliminatedSeat === i;
          const active =
            st.flowPhase === "roulette" &&
            !st.gameOver &&
            turnSeat === i &&
            Boolean(name);
          return (
            <RoulettePlayerCard
              key={i}
              name={name || `P${i + 1}`}
              turns={st.turnsBySeat[i] ?? 0}
              isActive={active}
              playerIndex={i}
              isEliminated={eliminated}
              isOffline={Boolean(name) && !seatOnline(props.snapshot, i)}
            />
          );
        })}
      </div>

      {st.flowPhase === "roulette" ? (
        <motion.div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
            padding: "8px 16px 24px",
            zIndex: 10,
          }}
        >
          <div style={{ minHeight: 28, display: "flex", alignItems: "center" }}>
            {!st.gameOver ? (
              <motion.p
                key={`turn-${turnSeat}-${st.spinSeq}`}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 3,
                  color: turnColor,
                }}
              >
                Ход: {turnName}
              </motion.p>
            ) : null}
          </div>

          <Cylinder
            currentPos={st.chamberPos}
            bulletPos={st.bulletPos}
            isSpinning={st.isSpinning}
            gameOver={st.gameOver}
          />

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            <button
              type="button"
              className="adepts-btn adepts-btn--primary"
              disabled={!canSpin}
              onClick={handleSpin}
              style={{
                opacity: canSpin ? 1 : 0.45,
                borderColor: "#9b59b6",
              }}
            >
              Крутить
            </button>
            <button
              type="button"
              className="adepts-btn"
              disabled={!canShoot}
              onClick={handleShoot}
              style={{ opacity: canShoot ? 1 : 0.45 }}
            >
              Нажать на курок
            </button>
          </div>

          {isHost ? (
            <button
              type="button"
              className="adepts-btn"
              style={{ fontSize: 11, opacity: 0.75 }}
              onClick={() => props.send("advance_turn", {})}
            >
              Следующий ход (ведущий)
            </button>
          ) : !canAct ? (
            <p style={{ margin: 0, fontSize: 12, opacity: 0.65 }}>Ожидайте своего хода…</p>
          ) : null}
        </motion.div>
      ) : st.flowPhase === "done" ? (
        <motion.div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 24,
          }}
        >
          <p style={{ margin: 0, fontFamily: "monospace", fontSize: 13, color: "#888", textAlign: "center" }}>
            Рулетка завершена
          </p>
          {isHost ? (
            <button
              type="button"
              className="adepts-btn adepts-btn--primary"
              onClick={() => props.send("close_roulette_field", {})}
            >
              Вернуться к доске
            </button>
          ) : (
            <p style={{ margin: 0, fontSize: 12, opacity: 0.65 }}>Ожидайте ведущего…</p>
          )}
        </motion.div>
      ) : null}

      <AnimatePresence>
        {showLottery ? (
          <LotteryOverlay
            key="lottery"
            snapshot={props.snapshot}
            role={props.role}
            participantId={props.participantId}
            freedSeat={st.freedSeat}
            wsSend={props.wsSend}
            onFinishLottery={() => props.send("finish_lottery", {})}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function registerClient(registry: PluginClientRegistry): void {
  registry.registerCardKindClient(CARD_KIND, {
    label: "Ящик Пандоры (рулетка)",
    description: "Русская рулетка и лото после выбывания игрока",
    FullScreenView: PandoraFullScreen,
  });
}
