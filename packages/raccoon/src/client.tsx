/**
 * @adept-plugins/raccoon — client entry
 *
 * Full-screen spiral splash (ported from Node-Script QuestionModal) plus
 * synchronized “pass turn to seat” controls after dismiss.
 */

import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import type {
  ActiveCard,
  CardActionProps,
  PluginClientRegistry,
  QuestionCell,
  SessionSnapshot,
} from "@adept/plugin-sdk";
import type { RaccoonPluginState } from "./state.js";

const CARD_KIND = "raccoon";

/** Default asset on Adept-Game session HTTP (`backend/data/app/raccoon.png`). */
const DEFAULT_RACCOON_SPLASH = "/app/raccoon.png";

function getHttpBaseForQuizAssets(): string {
  if (typeof window === "undefined") return "";
  const { protocol, hostname, port } = window.location;
  const isHttps = protocol === "https:";
  const devSpa = port === "5173" || port === "4173";
  const sessionPort = devSpa ? "3847" : port;
  const host =
    hostname.includes(":") && !hostname.startsWith("[") ? `[${hostname}]` : hostname;
  if (!sessionPort || sessionPort === "80" || sessionPort === "443") {
    return `${isHttps ? "https" : "http"}://${host}`;
  }
  return `${isHttps ? "https" : "http"}://${host}:${sessionPort}`;
}

function resolveSplashUrl(raw: string): string {
  const u = raw.trim();
  if (!u) return u;
  if (u.startsWith("http") || u.startsWith("//")) return u;
  const base = getHttpBaseForQuizAssets();
  return `${base}${u.startsWith("/") ? u : `/${u}`}`;
}

function readActiveQuestionCell(snapshot: SessionSnapshot, active: ActiveCard): QuestionCell | null {
  const board =
    active.board === "finalTransition"
      ? snapshot.finalTransitionBoard
      : active.roundIndex
        ? snapshot.roundBoard[active.roundIndex]
        : null;
  if (!board) return null;
  return board.questions[active.rowIndex]?.[active.colIndex] ?? null;
}

function raccoonSplashSource(cell: QuestionCell, cardParams: unknown): string {
  let fromParams = "";
  if (cardParams && typeof cardParams === "object") {
    const su = (cardParams as Record<string, unknown>)["splashUrl"];
    if (typeof su === "string") fromParams = su;
  }
  const fromCell = cell.splashUrl?.trim() ?? "";
  return resolveSplashUrl(fromParams || fromCell || DEFAULT_RACCOON_SPLASH);
}

function parsePluginState(raw: unknown): RaccoonPluginState {
  if (!raw || typeof raw !== "object") return {};
  return raw as RaccoonPluginState;
}

function splashDismissHostOnly(cardParams: unknown): boolean {
  if (!cardParams || typeof cardParams !== "object") return false;
  return (cardParams as Record<string, unknown>)["splashDismissHostOnly"] === true;
}

function viewerSeatIndex(snapshot: SessionSnapshot, participantId: string): number | null {
  const me = snapshot.participants
    .find((p) => p.id === participantId)
    ?.displayName?.trim()
    .toLowerCase();
  if (!me) return null;
  for (let i = 0; i < 5; i++) {
    const sn = (snapshot.seatNames[i] ?? "").trim().toLowerCase();
    if (sn && sn === me) return i;
  }
  return null;
}

function canDismissSplash(
  snapshot: SessionSnapshot,
  role: CardActionProps["role"],
  participantId: string,
  cardParams: unknown,
): boolean {
  if (splashDismissHostOnly(cardParams)) return role === "host";
  if (role === "host") return true;
  const seat = viewerSeatIndex(snapshot, participantId);
  const turn = ((Math.floor(Number(snapshot.currentTurnSeat)) % 5) + 5) % 5;
  return seat !== null && seat === turn;
}

function canChoosePassTarget(
  snapshot: SessionSnapshot,
  role: CardActionProps["role"],
  participantId: string,
  cardParams: unknown,
): boolean {
  return canDismissSplash(snapshot, role, participantId, cardParams);
}

// --- Spiral + splash (Node-Script QuestionModal.tsx) --------------------------------

const SPIRAL = (() => {
  const rotations = 2;
  const steps = 48;
  const rxMax = 960;
  const ryMax = 560;
  const xs: number[] = [];
  const ys: number[] = [];
  const scales: number[] = [];
  const times: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const theta = t * rotations * 2 * Math.PI;
    const rx = rxMax * (1 - t);
    const ry = ryMax * (1 - t);
    xs.push(Math.round(rx * Math.sin(theta)));
    ys.push(Math.round(-ry * Math.cos(theta)));
    scales.push(Math.round((0.05 + 0.95 * t) * 100) / 100);
    times.push(Math.round(t * 10000) / 10000);
  }
  return { xs, ys, scales, times };
})();

type SparkParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  color: string;
  life: number;
  decay: number;
};

const MAGIC_COLORS = [
  "#FFD700",
  "#FFFFFF",
  "#FF88FF",
  "#44FFFF",
  "#FFAA44",
  "#FF44AA",
  "#BBFFAA",
  "#FF6644",
];
const SPLASH_DURATION = 3500;

function interpolateSpiral(t: number) {
  const times = SPIRAL.times;
  let i = times.length - 2;
  for (let j = 0; j < times.length - 1; j++) {
    if (t <= times[j + 1]) {
      i = j;
      break;
    }
  }
  const seg = times[i + 1] === times[i] ? 0 : (t - times[i]) / (times[i + 1] - times[i]);
  return {
    x: SPIRAL.xs[i] + (SPIRAL.xs[i + 1] - SPIRAL.xs[i]) * seg,
    y: SPIRAL.ys[i] + (SPIRAL.ys[i + 1] - SPIRAL.ys[i]) * seg,
  };
}

function RaccoonSplashOverlay({
  url,
  canDismiss,
  onDismiss,
}: {
  url: string;
  canDismiss: boolean;
  onDismiss: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<SparkParticle[]>([]);
  const rafRef = useRef<number | undefined>(undefined);
  const startRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    startRef.current = performance.now();
    particlesRef.current = [];

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const elapsed = performance.now() - startRef.current;
      const t = Math.min(elapsed / SPLASH_DURATION, 1);
      const pos = interpolateSpiral(t);
      const cx = canvas.width / 2 + pos.x;
      const cy = canvas.height / 2 + pos.y;

      if (t < 0.98) {
        const sparkCount = Math.round(6 + t * 20);
        const currentScale = 0.05 + 0.95 * t;
        const maxRadius = Math.min(canvas.width * 0.39, canvas.height * 0.39);
        const raccoonRadius = maxRadius * currentScale;
        for (let k = 0; k < sparkCount; k++) {
          const spawnAngle = Math.random() * Math.PI * 2;
          const speed = 0.8 + Math.random() * 3.5;
          const spawnX = cx + Math.cos(spawnAngle) * raccoonRadius;
          const spawnY = cy + Math.sin(spawnAngle) * raccoonRadius;
          particlesRef.current.push({
            x: spawnX,
            y: spawnY,
            vx: Math.cos(spawnAngle) * speed + (Math.random() - 0.5) * 1.5,
            vy: Math.sin(spawnAngle) * speed - 0.8 + (Math.random() - 0.5) * 1.5,
            alpha: 1,
            size: 2 + Math.random() * 5,
            color: MAGIC_COLORS[Math.floor(Math.random() * MAGIC_COLORS.length)] ?? "#fff",
            life: 0,
            decay: 0.016 + Math.random() * 0.024,
          });
        }
      }

      const alive: SparkParticle[] = [];
      for (const p of particlesRef.current) {
        p.life += p.decay;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        p.vx *= 0.97;
        p.size *= 0.97;
        p.alpha = Math.max(0, 1 - p.life);
        if (p.life < 1 && p.size > 0.3) {
          alive.push(p);
          ctx.save();
          ctx.globalAlpha = p.alpha * 0.85;
          ctx.shadowBlur = 14;
          ctx.shadowColor = p.color;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = p.alpha * 0.55;
          ctx.shadowBlur = 0;
          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.38, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      particlesRef.current = alive;
    };

    loop();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <motion.div
      className={`adept-raccoon-splash ${canDismiss ? "adept-raccoon-splash--dismissible" : "adept-raccoon-splash--locked"}`}
      onClick={canDismiss ? onDismiss : undefined}
      role={canDismiss ? "button" : undefined}
      tabIndex={canDismiss ? 0 : undefined}
      onKeyDown={
        canDismiss
          ? (e: KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onDismiss();
              }
            }
          : undefined
      }
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
      aria-label={canDismiss ? "Закрыть заставку енота" : undefined}
    >
      <canvas ref={canvasRef} className="adept-raccoon-splash__canvas" aria-hidden />
      <motion.img
        src={url}
        alt=""
        draggable={false}
        initial={{ x: SPIRAL.xs[0], y: SPIRAL.ys[0], scale: 0.05, rotate: 0 }}
        animate={{
          x: SPIRAL.xs,
          y: SPIRAL.ys,
          scale: SPIRAL.scales,
          rotate: 0,
          transition: {
            duration: 3.5,
            ease: "linear",
            times: SPIRAL.times,
          },
        }}
        exit={{ scale: 0, opacity: 0, transition: { duration: 0.28, ease: "easeIn" } }}
        className="adept-raccoon-splash__img"
      />
    </motion.div>
  );
}

function RaccoonPreReveal(props: CardActionProps) {
  const { snapshot, activeCard, cardParams, pluginState, role, participantId, send } = props;
  const cell = readActiveQuestionCell(snapshot, activeCard);
  if (!cell) return null;
  if (activeCard.stage !== "question") return null;

  const st = parsePluginState(pluginState);
  const splashDismissed = st.splashDismissed === true;
  const seatPassUsed = st.seatPassUsed === true;
  const splashUrl = raccoonSplashSource(cell, cardParams);
  const turn = ((Math.floor(Number(snapshot.currentTurnSeat)) % 5) + 5) % 5;
  const hoverRaw = st.passHoverSeat;
  const passHoverSeatNorm =
    typeof hoverRaw === "number" &&
    Number.isInteger(hoverRaw) &&
    hoverRaw >= 0 &&
    hoverRaw <= 4 &&
    hoverRaw !== turn
      ? hoverRaw
      : null;

  const showPassPanel =
    splashDismissed &&
    !seatPassUsed &&
    cell.splashVariant !== "dedFly";

  const dismissAllowed = canDismissSplash(snapshot, role, participantId, cardParams);
  const passAllowed = canChoosePassTarget(snapshot, role, participantId, cardParams);

  const raccoonCss = `
        .adept-raccoon-splash {
          position: fixed;
          inset: 0;
          z-index: 1100;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(9, 9, 12, 0.92);
          backdrop-filter: blur(8px);
        }
        .adept-raccoon-splash--dismissible { cursor: pointer; }
        .adept-raccoon-splash--locked { cursor: default; pointer-events: none; }
        .adept-raccoon-splash__canvas {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .adept-raccoon-splash__img {
          max-width: 78vw;
          max-height: 78vh;
          object-fit: contain;
          pointer-events: none;
          position: relative;
        }
        .adept-raccoon-pass {
          margin-top: 1rem;
          padding: 1rem 1rem 1.25rem;
          border-top: 1px solid hsla(280, 35%, 42%, 0.35);
        }
        .adept-raccoon-pass__title {
          margin: 0 0 0.75rem;
          text-align: center;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: hsl(220 12% 65%);
        }
        .adept-raccoon-pass__grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.5rem;
          max-width: 36rem;
          margin: 0 auto;
        }
        @media (min-width: 720px) {
          .adept-raccoon-pass__grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        }
        .adept-raccoon-pass__btn {
          display: flex;
          min-height: 6.5rem;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border-radius: 0.65rem;
          border: 1px solid hsla(280, 65%, 50%, 0.35);
          background: hsla(270, 35%, 14%, 0.85);
          color: hsl(280 92% 88%);
          font-weight: 700;
          transition: box-shadow 0.12s ease, background 0.12s ease, border-color 0.12s ease, transform 0.12s ease;
        }
        .adept-raccoon-pass__btn--on {
          border-color: hsl(280 65% 55%);
          box-shadow: 0 0 22px hsla(280, 65%, 50%, 0.45);
          transform: translateY(-2px) scale(1.04);
        }
        .adept-raccoon-pass__btn--enabled { cursor: pointer; }
        .adept-raccoon-pass__btn--disabled {
          pointer-events: none;
          opacity: 0.55;
          cursor: default;
        }
      `;

  return (
    <>
      <style>{raccoonCss}</style>
      {createPortal(
        <AnimatePresence>
          {!splashDismissed && splashUrl ? (
            <RaccoonSplashOverlay
              key="adept-raccoon-splash"
              url={splashUrl}
              canDismiss={dismissAllowed}
              onDismiss={() => send("dismiss_splash", null)}
            />
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
      {showPassPanel ? (
        <div className="adept-raccoon-pass">
          <p className="adept-raccoon-pass__title">Передайте ход другому игроку</p>
          <div
            className="adept-raccoon-pass__grid"
            onPointerLeave={() => {
              if (passAllowed) send("set_pass_hover", { seat: null });
            }}
          >
            {([0, 1, 2, 3, 4] as const).map((i) => {
              if (i === turn) return null;
              const label = (snapshot.seatNames[i] ?? "").trim()
                ? snapshot.seatNames[i]
                : `Игрок ${i + 1}`;
              const syncHovered = passHoverSeatNorm === i;
              return (
                <button
                  key={i}
                  type="button"
                  className={[
                    "adept-raccoon-pass__btn",
                    syncHovered ? "adept-raccoon-pass__btn--on" : "",
                    passAllowed ? "adept-raccoon-pass__btn--enabled" : "adept-raccoon-pass__btn--disabled",
                  ].join(" ")}
                  onPointerEnter={() => {
                    if (passAllowed) send("set_pass_hover", { seat: i });
                  }}
                  onClick={() => {
                    if (passAllowed) send("pass_turn_to_seat", { targetSeat: i });
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </>
  );
}

export function registerClient(registry: PluginClientRegistry): void {
  registry.registerCardKindClient(CARD_KIND, {
    label: "Енот в мешке",
    description:
      "Показывает анимацию енота; после неё ведущий или игрок с ходом передаёт ход выбранному месту.",
    PreRevealAction: RaccoonPreReveal,
  });
}
