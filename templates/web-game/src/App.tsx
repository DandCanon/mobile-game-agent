import { useState, useEffect, useCallback, useRef } from 'react';
import {
  createInitialState,
  loadGame,
  saveGame,
  clearSave,
  performClick,
  calculateTimeAdvance,
  getIncomePerSec,
  checkAchievements,
  buyUpgrade,
} from './game/GameEngine';
import type { GameState, OfflineEarnings, Achievement } from './game/types';
import { ResourceDisplay } from './game/components/ResourceDisplay';
import { ClickArea } from './game/components/ClickArea';
import { UpgradePanel } from './game/components/UpgradePanel';
import { OfflineEarningsModal } from './game/components/OfflineEarningsModal';
import { AchievementToast } from './game/components/AchievementToast';

export default function App() {
  const [state, setState] = useState<GameState>(() => {
    const saved = loadGame();
    return saved ?? createInitialState();
  });
  const [offline, setOffline] = useState<OfflineEarnings | null>(null);
  const [toasts, setToasts] = useState<Achievement[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setInterval>>();

  // 初始化：计算离线收益
  useEffect(() => {
    const now = Date.now();
    const { state: advanced, offline: off } = calculateTimeAdvance(state, now);
    if (off.earnings > 0) {
      setState(advanced);
      setOffline(off);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 自动收益 tick（每秒）
  useEffect(() => {
    const income = getIncomePerSec(state);
    if (income <= 0) return;

    const tick = setInterval(() => {
      setState((prev) => ({ ...prev, gold: prev.gold + income / 10 }));
    }, 100);

    return () => clearInterval(tick);
  }, [state.upgrades]);

  // 定时存档（每 5 秒）
  useEffect(() => {
    saveTimerRef.current = setInterval(() => {
      setState((prev) => {
        saveGame(prev);
        return prev;
      });
    }, 5000);
    return () => clearInterval(saveTimerRef.current);
  }, []);

  // 页面隐藏时存档
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        setState((prev) => {
          saveGame(prev);
          return prev;
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // 处理点击
  const handleClick = useCallback(() => {
    setState((prev) => {
      const clicked = performClick(prev);
      const { state: withAch, newAchievements } = checkAchievements(clicked);
      if (newAchievements.length > 0) {
        setToasts((t) => [...t, ...newAchievements]);
      }
      return withAch;
    });
  }, []);

  // 处理升级
  const handleUpgrade = useCallback((upgradeId: string) => {
    setState((prev) => {
      const result = buyUpgrade(prev, upgradeId);
      if (!result.success) return prev;
      const { state: withAch, newAchievements } = checkAchievements(result.state);
      if (newAchievements.length > 0) {
        setToasts((t) => [...t, ...newAchievements]);
      }
      return withAch;
    });
  }, []);

  const handleDismissOffline = useCallback(() => setOffline(null), []);
  const handleDismissToast = useCallback((id: string) => {
    setToasts((t) => t.filter((a) => a.id !== id));
  }, []);

  // 重置游戏
  const handleReset = useCallback(() => {
    if (window.confirm('确定要重置所有游戏进度吗？此操作不可恢复。')) {
      clearSave();
      setState(createInitialState());
      setOffline(null);
      setToasts([]);
    }
  }, []);

  return (
    <div className="h-[100dvh] flex flex-col max-w-md mx-auto relative">
      {/* 顶部资源栏 */}
      <ResourceDisplay state={state} onReset={handleReset} />

      {/* 中间点击区域 */}
      <ClickArea state={state} onClick={handleClick} />

      {/* 底部升级面板 */}
      <UpgradePanel state={state} onUpgrade={handleUpgrade} />

      {/* 离线收益弹窗 */}
      {offline && (
        <OfflineEarningsModal offline={offline} onDismiss={handleDismissOffline} />
      )}

      {/* 成就提示 */}
      {toasts.map((a) => (
        <AchievementToast key={a.id} achievement={a} onDismiss={() => handleDismissToast(a.id)} />
      ))}
    </div>
  );
}
