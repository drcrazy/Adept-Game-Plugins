import { motion } from "framer-motion";

export const PLAYER_COLORS = [
  "#3498db",
  "#e74c3c",
  "#2ecc71",
  "#f39c12",
  "#9b59b6",
] as const;

const BG_RGBA = [
  "52,152,219",
  "231,76,60",
  "46,204,113",
  "243,156,18",
  "155,89,182",
] as const;

export type RoulettePlayerCardProps = {
  name: string;
  turns: number;
  isActive: boolean;
  playerIndex: number;
  isEliminated: boolean;
  isOffline?: boolean;
};

export function RoulettePlayerCard({
  name,
  turns,
  isActive,
  playerIndex,
  isEliminated,
  isOffline,
}: RoulettePlayerCardProps) {
  const color = PLAYER_COLORS[playerIndex] ?? "#9b59b6";

  return (
    <motion.div
      animate={
        isEliminated
          ? { scale: 0.85, opacity: 0.25 }
          : isOffline
            ? { scale: 0.9, opacity: 0.35 }
            : isActive
              ? { scale: 1.12, opacity: 1 }
              : { scale: 1, opacity: 0.6 }
      }
      transition={{ duration: 0.4 }}
      className="roulette-player-card"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding: "12px 16px",
        borderRadius: 12,
        minWidth: 96,
        boxShadow: isActive && !isEliminated && !isOffline ? `0 0 20px ${color}` : "none",
        background:
          isActive && !isEliminated && !isOffline
            ? `rgba(${BG_RGBA[playerIndex] ?? "155,89,182"},0.08)`
            : "transparent",
        border: `1px solid ${isActive && !isEliminated && !isOffline ? color : "transparent"}`,
      }}
    >
      <motion.div
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 2,
          marginBottom: 6,
          color: isEliminated || isOffline ? "#444" : color,
        }}
      >
        {name || `P${playerIndex + 1}`}
      </motion.div>
      <motion.div
        style={{
          fontSize: 36,
          fontWeight: 700,
          color: isEliminated || isOffline ? "#333" : "white",
        }}
      >
        {turns}
      </motion.div>
      {isEliminated ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            marginTop: 4,
            fontSize: 10,
            fontFamily: "monospace",
            textTransform: "uppercase",
            letterSpacing: 3,
            color: "#e74c3c",
          }}
        >
          Bang
        </motion.div>
      ) : null}
      {isOffline && !isEliminated ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            marginTop: 4,
            fontSize: 10,
            fontFamily: "monospace",
            textTransform: "uppercase",
            letterSpacing: 3,
            color: "#666",
          }}
        >
          offline
        </motion.div>
      ) : null}
    </motion.div>
  );
}
