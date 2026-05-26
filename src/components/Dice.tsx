"use client";

import { useEffect, useState } from "react";

interface DiceProps {
  value: number | null;
  isRolling: boolean;
  disabled: boolean;
  onRoll: () => void;
  color: string;
}

const DOT_POSITIONS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

function DiceFace({ value, color }: { value: number; color: string }) {
  const dots = DOT_POSITIONS[value] || [];
  return (
    <div className="grid grid-cols-3 grid-rows-3 gap-0 w-full h-full p-3.5">
      {Array.from({ length: 9 }).map((_, i) => {
        const r = Math.floor(i / 3);
        const c = i % 3;
        const has = dots.some(([dr, dc]) => dr === r && dc === c);
        return (
          <div key={i} className="flex items-center justify-center">
            {has && (
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: color }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Dice({ value, isRolling, disabled, onRoll, color }: DiceProps) {
  const [displayValue, setDisplayValue] = useState(value || 1);

  useEffect(() => {
    if (isRolling) {
      const interval = setInterval(() => {
        setDisplayValue(Math.floor(Math.random() * 6) + 1);
      }, 80);
      return () => clearInterval(interval);
    } else if (value !== null) {
      setDisplayValue(value);
    }
  }, [isRolling, value]);

  const showNeutral = value === null && !isRolling;

  return (
    <button
      onClick={onRoll}
      disabled={disabled || isRolling}
      className={`
        relative w-full aspect-square rounded-2xl bg-white
        border border-neutral-200
        transition-all duration-200
        ${disabled
          ? "opacity-40 cursor-not-allowed"
          : "hover:border-neutral-400 hover:shadow-md cursor-pointer active:scale-95"
        }
      `}
    >
      {showNeutral ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl font-bold" style={{ color }}>?</span>
        </div>
      ) : (
        <div
          className={`absolute inset-0 ${isRolling ? "animate-spin" : ""}`}
          style={{ animationDuration: isRolling ? "0.6s" : undefined }}
        >
          <DiceFace value={displayValue} color={color} />
        </div>
      )}
    </button>
  );
}
