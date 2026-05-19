import { motion, useMotionValue, animate } from "framer-motion";
import { useEffect, useRef } from "react";

const SPIN_DURATION_S = 1.7;

export type CylinderProps = {
  currentPos: number;
  bulletPos: number;
  isSpinning: boolean;
  gameOver: boolean;
};

export function Cylinder({ currentPos, bulletPos, isSpinning, gameOver }: CylinderProps) {
  const chambers = [0, 1, 2, 3, 4, 5];
  const rotate = useMotionValue(0);
  const absRot = useRef(0);
  const wasSpinning = useRef(false);
  const prevPos = useRef(currentPos);

  useEffect(() => {
    if (isSpinning && !wasSpinning.current) {
      wasSpinning.current = true;
      const next = absRot.current + 360 * 5;
      animate(rotate, next, { duration: SPIN_DURATION_S, ease: [0.4, 0, 0.6, 1] });
      absRot.current = next;
    } else if (!isSpinning && wasSpinning.current) {
      wasSpinning.current = false;
      const targetAngle = ((currentPos * -60) % 360 + 360) % 360;
      const spinEndAngle = ((absRot.current % 360) + 360) % 360;
      let delta = targetAngle - spinEndAngle;
      if (delta < 0) delta += 360;
      const settleTo = absRot.current + delta;
      animate(rotate, settleTo, { duration: 0.35, ease: "easeOut" });
      absRot.current = settleTo;
      prevPos.current = currentPos;
    }
  }, [isSpinning, currentPos, rotate]);

  useEffect(() => {
    if (isSpinning || wasSpinning.current) return;
    if (currentPos === prevPos.current) return;
    prevPos.current = currentPos;
    const targetAngle = ((currentPos * -60) % 360 + 360) % 360;
    const currentAngle = ((absRot.current % 360) + 360) % 360;
    let delta = targetAngle - currentAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    const moveTo = absRot.current + delta;
    animate(rotate, moveTo, { type: "spring", stiffness: 200, damping: 22 });
    absRot.current = moveTo;
  }, [currentPos, isSpinning, rotate]);

  return (
    <motion.div
      className="roulette-cylinder"
      style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div
        className="roulette-cylinder__glow"
        style={{
          position: "absolute",
          width: 290,
          height: 290,
          borderRadius: "50%",
          boxShadow: isSpinning
            ? "0 0 50px rgba(155,89,182,0.6), 0 0 100px rgba(155,89,182,0.2)"
            : "0 0 20px rgba(155,89,182,0.4)",
          transition: "box-shadow 0.5s",
        }}
      />
      <motion.div
        className="roulette-cylinder__drum"
        style={{
          width: 260,
          height: 260,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.95)",
          border: "4px solid #9b59b6",
          boxShadow: "0 0 20px #9b59b6, inset 0 0 40px rgba(0,0,0,0.8)",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          rotate,
        }}
      >
        <motion.div
          className="roulette-cylinder__hub"
          style={{
            position: "absolute",
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "#0a0a0a",
            border: "2px solid #9b59b6",
            zIndex: 10,
          }}
        />
        {chambers.map((i) => {
          const angle = i * 60;
          const radius = 85;
          const x = Math.sin((angle * Math.PI) / 180) * radius;
          const y = -Math.cos((angle * Math.PI) / 180) * radius;
          const isBullet = gameOver && bulletPos === i;
          return (
            <div
              key={i}
              className="roulette-cylinder__chamber"
              style={{
                position: "absolute",
                width: 50,
                height: 50,
                borderRadius: "50%",
                transform: `translate(${x}px, ${y}px)`,
                background: isBullet ? "#f1c40f" : "#111",
                border: isBullet ? "2px solid #f1c40f" : "2px solid #222",
                boxShadow: isBullet
                  ? "0 0 30px #f1c40f, inset 0 0 10px rgba(241,196,15,0.3)"
                  : "inset 0 10px 20px rgba(0,0,0,0.9)",
                transition: "background 0.3s, box-shadow 0.3s",
              }}
            />
          );
        })}
      </motion.div>
      <motion.div
        className="roulette-cylinder__pointer"
        style={{
          position: "absolute",
          top: -12,
          left: "50%",
          marginLeft: -10,
          width: 0,
          height: 0,
          borderLeft: "10px solid transparent",
          borderRight: "10px solid transparent",
          borderTop: "16px solid #9b59b6",
          filter: "drop-shadow(0 0 6px rgba(155,89,182,0.9))",
          zIndex: 20,
        }}
      />
    </motion.div>
  );
}

export const CYLINDER_SPIN_MS = Math.round(SPIN_DURATION_S * 1000);
