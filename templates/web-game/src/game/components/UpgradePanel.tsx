import type { GameState } from '../types';
import { getUpgradeCost } from '../GameEngine';

interface Props {
  state: GameState;
  onUpgrade: (upgradeId: string) => void;
}

export function UpgradePanel({ state, onUpgrade }: Props) {
  const formatGold = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  const clickUpgrades = state.upgrades.filter((u) => u.category === 'click_power');
  const autoUpgrades = state.upgrades.filter((u) => u.category === 'auto_income');

  return (
    <footer className="shrink-0 bg-gray-900/90 backdrop-blur-sm border-t border-gray-800 max-h-[45%] overflow-y-auto no-scrollbar">
      <div className="px-3 py-2 space-y-2">
        {/* 点击类升级 */}
        {clickUpgrades.length > 0 && (
          <div>
            <h3 className="text-xs text-gray-500 mb-1 px-1">点击升级</h3>
            <div className="space-y-1.5">
              {clickUpgrades.map((up) => {
                const cost = getUpgradeCost(up);
                const canBuy = state.gold >= cost && up.level < up.maxLevel;
                return (
                  <button
                    key={up.id}
                    disabled={!canBuy}
                    onClick={() => onUpgrade(up.id)}
                    className={`
                      btn-game w-full flex items-center justify-between px-3 py-2.5 text-left
                      ${canBuy ? 'bg-gray-800 hover:bg-gray-750 border border-gray-700' : 'bg-gray-800/50 border border-gray-800'}
                    `}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white truncate">
                        {up.name}
                        <span className="text-xs text-gold ml-1">Lv.{up.level}</span>
                        {up.level >= up.maxLevel && (
                          <span className="text-xs text-emerald-400 ml-1">MAX</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 truncate">{up.description}</div>
                    </div>
                    <div className="shrink-0 ml-2 text-right">
                      <div className={`text-xs font-mono ${canBuy ? 'text-gold' : 'text-red-400/60'}`}>
                        {up.level >= up.maxLevel ? '--' : `💰 ${formatGold(cost)}`}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 自动收益升级 */}
        {autoUpgrades.length > 0 && (
          <div>
            <h3 className="text-xs text-gray-500 mb-1 px-1">自动生产</h3>
            <div className="space-y-1.5">
              {autoUpgrades.map((up) => {
                const cost = getUpgradeCost(up);
                const canBuy = state.gold >= cost && up.level < up.maxLevel;
                return (
                  <button
                    key={up.id}
                    disabled={!canBuy}
                    onClick={() => onUpgrade(up.id)}
                    className={`
                      btn-game w-full flex items-center justify-between px-3 py-2.5 text-left
                      ${canBuy ? 'bg-gray-800 hover:bg-gray-750 border border-gray-700' : 'bg-gray-800/50 border border-gray-800'}
                    `}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white truncate">
                        {up.name}
                        <span className="text-xs text-emerald-400 ml-1">Lv.{up.level}</span>
                        {up.level >= up.maxLevel && (
                          <span className="text-xs text-emerald-400 ml-1">MAX</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 truncate">{up.description}</div>
                    </div>
                    <div className="shrink-0 ml-2 text-right">
                      <div className={`text-xs font-mono ${canBuy ? 'text-gold' : 'text-red-400/60'}`}>
                        {up.level >= up.maxLevel ? '--' : `💰 ${formatGold(cost)}`}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 底部留白 */}
        <div className="h-4" />
      </div>
    </footer>
  );
}
