import { useState, useEffect } from 'react';
import type { OfflineEarnings } from '../types';

interface Props {
  offline: OfflineEarnings;
  onDismiss: () => void;
}

export function OfflineEarningsModal({ offline, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(t);
  }, []);

  const formatGold = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  if (offline.earnings <= 0) return null;

  return (
    <div
      className={`
        absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm
        transition-opacity duration-500
        ${visible ? 'opacity-100' : 'opacity-0'}
      `}
      onClick={onDismiss}
    >
      <div
        className="bg-gray-900 border border-gold/30 rounded-2xl px-8 py-6 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-5xl mb-3">🏠</div>
        <div className="text-gray-400 text-sm mb-1">
          你离开了 {offline.durationText}
        </div>
        <div className="text-2xl font-bold text-gold mb-1">
          +{formatGold(offline.earnings)}
        </div>
        <div className="text-xs text-gray-500 mb-4">
          离线期间自动挖矿收益
        </div>
        <button
          onClick={onDismiss}
          className="btn-game bg-gold/20 text-gold border border-gold/30 px-8 py-2 text-sm"
        >
          领取
        </button>
      </div>
    </div>
  );
}
