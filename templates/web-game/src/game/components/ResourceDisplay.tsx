import type { GameState } from '../types';
import { getIncomePerSec } from '../GameEngine';

interface Props {
  state: GameState;
  onReset: () => void;
}

export function ResourceDisplay({ state, onReset }: Props) {
  const income = getIncomePerSec(state);
  const formatGold = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
    return Math.floor(n).toLocaleString();
  };

  return (
    <header className="shrink-0 bg-gray-900/90 backdrop-blur-sm border-b border-gray-800 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* 金币 */}
          <div className="flex items-center gap-1.5">
            <span className="text-2xl">🪙</span>
            <span className="text-xl font-bold text-gold tabular-nums">
              {formatGold(state.gold)}
            </span>
          </div>
          {/* 钻石 */}
          <div className="flex items-center gap-1.5">
            <span className="text-lg">💎</span>
            <span className="text-lg font-semibold text-gem tabular-nums">
              {state.gems}
            </span>
          </div>
        </div>

        <button
          onClick={onReset}
          className="text-xs text-gray-500 hover:text-red-400 transition-colors px-2 py-1"
          title="重置游戏"
        >
          重置
        </button>
      </div>

      {/* 每秒收益 */}
      {income > 0 && (
        <div className="mt-1 text-xs text-emerald-400/70">
          +{formatGold(income)}/秒
        </div>
      )}
    </header>
  );
}
