import { useState, useCallback, useRef } from 'react';
import type { GameState } from '../types';
import { getClickValue } from '../GameEngine';

interface Props {
  state: GameState;
  onClick: () => void;
}

interface FloatText {
  id: number;
  x: number;
  y: number;
  value: number;
}

let floatId = 0;

export function ClickArea({ state, onClick }: Props) {
  const [floats, setFloats] = useState<FloatText[]>([]);
  const areaRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = areaRef.current?.getBoundingClientRect();
      if (rect) {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const id = ++floatId;
        const value = getClickValue(state);
        setFloats((prev) => [...prev.slice(-8), { id, x, y, value }]);
        setTimeout(() => {
          setFloats((prev) => prev.filter((f) => f.id !== id));
        }, 1000);
      }
      onClick();
    },
    [state, onClick],
  );

  const clickValue = getClickValue(state);

  return (
    <div
      ref={areaRef}
      className="flex-1 flex items-center justify-center relative overflow-hidden cursor-pointer"
      onClick={handleClick}
    >
      {/* 背景装饰 */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-gray-950 to-gray-900" />

      {/* 点击按钮 */}
      <div className="relative z-10">
        <div
          className="
            w-44 h-44 rounded-full
            bg-gradient-to-br from-gold/30 via-amber-500/40 to-orange-600/30
            border-4 border-gold/50
            flex flex-col items-center justify-center
            shadow-[0_0_40px_rgba(255,215,0,0.2)]
            animate-pulse-gold
            transition-transform duration-75
            active:scale-90
          "
        >
          <span className="text-5xl">⛏️</span>
          <span className="text-sm text-gold/80 mt-2 font-semibold">
            +{clickValue}
          </span>
        </div>
      </div>

      {/* 浮动数字 */}
      {floats.map((f) => (
        <span
          key={f.id}
          className="absolute text-gold font-bold text-xl pointer-events-none animate-float-up z-20"
          style={{ left: f.x, top: f.y }}
        >
          +{f.value}
        </span>
      ))}

      {/* 总点击数 */}
      <div className="absolute bottom-4 text-xs text-gray-600">
        累计点击: {state.totalClicks.toLocaleString()}
      </div>
    </div>
  );
}
