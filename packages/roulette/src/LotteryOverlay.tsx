import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Role, SessionSnapshot } from "@adept/plugin-sdk";

const BALL_COLORS = [
  "#e74c3c",
  "#e67e22",
  "#f1c40f",
  "#27ae60",
  "#3498db",
  "#8e44ad",
  "#16a085",
  "#c0392b",
];

function onlineSpectatorNames(snapshot: SessionSnapshot): string[] {
  const online = new Set(snapshot.onlineParticipantIds);
  const names: string[] = [];
  for (const p of snapshot.participants) {
    if (p.role !== "spectator") continue;
    if (!online.has(p.id)) continue;
    const n = p.displayName.trim();
    if (n && !names.includes(n)) names.push(n);
  }
  return names;
}

function seatOccupantNames(snapshot: SessionSnapshot): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < 5; i++) {
    const n = (snapshot.seatNames[i] ?? "").trim().toLowerCase();
    if (n) out.add(n);
  }
  return out;
}

type LotteryOverlayProps = {
  snapshot: SessionSnapshot;
  role: Role;
  participantId: string;
  freedSeat: number | null;
  wsSend: (type: string, payload: unknown) => void;
  onFinishLottery: () => void;
};

function LottoBtn({
  onClick,
  disabled,
  children,
  accent = "#f1c40f",
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  accent?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="adepts-btn"
      style={{
        background: "transparent",
        border: `1px solid ${disabled ? "#333" : accent}`,
        color: disabled ? "#333" : accent,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "monospace",
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: 2,
        padding: "10px 18px",
      }}
    >
      {children}
    </button>
  );
}

export function LotteryOverlay({
  snapshot,
  role,
  participantId,
  freedSeat,
  wsSend,
  onFinishLottery,
}: LotteryOverlayProps) {
  const lottery = snapshot.lottery;
  const me = snapshot.participants.find((p) => p.id === participantId);
  const myNick = me?.displayName.trim() ?? "";
  const isHost = role === "host";
  const isSpectator = role === "spectator";

  const pool = useMemo(
    () => lottery.candidates.filter((c) => !lottery.optOut[c]),
    [lottery.candidates, lottery.optOut],
  );

  const winnerNick = lottery.lastWinnerNick?.trim() ?? "";
  const winnerIdx = winnerNick ? lottery.candidates.indexOf(winnerNick) : -1;
  const winnerColor = winnerIdx >= 0 ? BALL_COLORS[winnerIdx % BALL_COLORS.length] : "#f1c40f";

  const iAmCandidate = myNick.length > 0 && lottery.candidates.includes(myNick);
  const iOptedOut = myNick.length > 0 && lottery.optOut[myNick] === true;

  const candidatesSeeded = useRef(false);
  useEffect(() => {
    if (!isHost) return;
    if (lottery.candidates.length > 0) {
      candidatesSeeded.current = true;
      return;
    }
    if (candidatesSeeded.current) return;
    const spectators = onlineSpectatorNames(snapshot);
    const occupied = seatOccupantNames(snapshot);
    const list = spectators.filter((n) => !occupied.has(n.toLowerCase()));
    if (list.length === 0) return;
    candidatesSeeded.current = true;
    wsSend("lottery_set_candidates", { candidates: list });
  }, [isHost, lottery.candidates.length, snapshot.version, snapshot, wsSend]);

  const handleDraw = () => {
    wsSend("lottery_draw", {});
  };

  const handleConfirm = () => {
    if (!winnerNick) return;
    const payload: Record<string, unknown> = { winnerNick };
    if (freedSeat !== null) payload.seat = freedSeat;
    wsSend("lottery_confirm_seat", payload);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.94)",
        padding: 24,
        overflow: "auto",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "1.75rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 4,
            color: "#f1c40f",
            textShadow: "0 0 24px rgba(241,196,15,0.5)",
            textAlign: "center",
          }}
        >
          Барабан Лото
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            fontFamily: "monospace",
            textTransform: "uppercase",
            letterSpacing: 3,
            color: "#666",
            textAlign: "center",
          }}
        >
          {freedSeat !== null
            ? `Место ${freedSeat + 1} освобождено — победитель займёт его`
            : "Случайный зритель станет игроком"}
        </p>

        <motion.div
          style={{
            width: "100%",
            maxHeight: 220,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {lottery.candidates.length === 0 ? (
            <p style={{ textAlign: "center", color: "#444", fontFamily: "monospace", fontSize: 12 }}>
              Нет участников в списке
            </p>
          ) : (
            lottery.candidates.map((name, i) => {
              const opted = lottery.optOut[name] === true;
              const color = BALL_COLORS[i % BALL_COLORS.length];
              return (
                <motion.div
                  key={name}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: opted ? 0.45 : 1, x: 0 }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    border: `1px solid ${color}44`,
                    background: `${color}11`,
                    color: opted ? "#666" : color,
                    fontFamily: "monospace",
                    fontSize: 13,
                    textTransform: "uppercase",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        background: color,
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 900,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </span>
                    {name}
                    {opted ? (
                      <span style={{ fontSize: 9, color: "#888", letterSpacing: 1 }}>— отказ</span>
                    ) : null}
                  </span>
                  {isHost ? (
                    <button
                      type="button"
                      onClick={() => wsSend("lottery_remove_candidate", { nick: name })}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#555",
                        cursor: "pointer",
                        fontSize: 18,
                        lineHeight: 1,
                        padding: "0 4px",
                      }}
                      title="Убрать из списка"
                      aria-label={`Убрать ${name}`}
                    >
                      ×
                    </button>
                  ) : null}
                </motion.div>
              );
            })
          )}
        </motion.div>

        {isSpectator && iAmCandidate && !iOptedOut ? (
          <LottoBtn
            onClick={() => wsSend("lottery_opt_out", { nick: myNick })}
            accent="#e74c3c"
          >
            Отказаться от участия
          </LottoBtn>
        ) : null}

        {isSpectator && iOptedOut ? (
          <p style={{ margin: 0, fontSize: 11, color: "#888", fontFamily: "monospace" }}>
            Вы отказались от участия в лото
          </p>
        ) : null}

        <AnimatePresence mode="wait">
          {winnerNick ? (
            <motion.div
              key="winner"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ textAlign: "center", width: "100%" }}
            >
              <p
                style={{
                  margin: "0 0 8px",
                  fontFamily: "monospace",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: 4,
                  color: "#f1c40f",
                }}
              >
                Счастливчик
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: "2rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 3,
                  color: winnerColor,
                  textShadow: `0 0 24px ${winnerColor}88`,
                }}
              >
                {winnerNick}
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {isHost ? (
          <motion.div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              justifyContent: "center",
              marginTop: 8,
            }}
          >
            <LottoBtn onClick={handleDraw} disabled={pool.length < 1} accent="#f1c40f">
              {winnerNick ? "Перекрутить" : "Запустить барабан"}
            </LottoBtn>
            {winnerNick ? (
              <LottoBtn onClick={handleConfirm} accent={winnerColor}>
                Подтвердить замену
              </LottoBtn>
            ) : null}
            <LottoBtn onClick={onFinishLottery} accent="#555">
              Закрыть лото
            </LottoBtn>
          </motion.div>
        ) : (
          <p style={{ margin: 0, fontSize: 11, color: "#666", fontFamily: "monospace", textAlign: "center" }}>
            {winnerNick
              ? "Ведущий подтверждает замену игрока…"
              : "Ожидайте, пока ведущий запустит барабан…"}
          </p>
        )}
      </div>
    </motion.div>
  );
}
