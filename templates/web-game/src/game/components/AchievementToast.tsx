import { useState, useEffect } from 'react';
import type { Achievement } from '../types';

interface Props {
  achievement: Achievement;
  onDismiss: () => void;
}

export function AchievementToast({ achievement, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = setTimeout(() => setVisible(true), 100);
    const hide = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, 2500);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [onDismiss]);

  return (
    <div
      className={`
        absolute top-16 left-4 right-4 z-40
        bg-gray-800/95 backdrop-blur-sm border border-gold/40 rounded-xl px-4 py-3
        shadow-[0_0_20px_rgba(255,215,0,0.15)]
        transition-all duration-300
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}
      `}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">🏆</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-gold">成就解锁!</div>
          <div className="text-xs text-gray-400">{achievement.name}</div>
          <div className="text-xs text-gray-500 truncate">{achievement.description}</div>
        </div>
        {achievement.rewardGems > 0 && (
          <div className="text-xs text-gem font-semibold">+{achievement.rewardGems}💎</div>
        )}
      </div>
    </div>
  );
}
