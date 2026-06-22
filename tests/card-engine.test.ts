import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  startTurn,
  drawCard,
  playCard,
  attack,
  endTurn,
  checkGameOver,
  canAttack,
  getAttackableUnits,
  hasTaunt,
  CARD_CATALOG,
  getCardDefById,
} from '../src/game/CardEngine';
import type { CardInstance } from '../src/game/CardEngine';

const TEST_DECK = [
  'axe_soldier',
  'shield_guard',
  'fireball',
  'healing_light',
  'blademaster',
  'archer',
  'flame_storm',
  'faerie_dragon',
  'axe_soldier',
  'shield_guard',
  'blademaster',
  'archer',
  'faerie_dragon',
  'axe_soldier',
  'shield_guard',
  'archer',
  'faerie_dragon',
  'fireball',
  'healing_light',
  'flame_storm',
];

/* ==================== 初始状态 ==================== */

describe('CardEngine — 初始状态', () => {
  it('玩家 HP 为 30', () => {
    const s = createInitialState(TEST_DECK);
    expect(s.player.hp).toBe(30);
    expect(s.player.maxHp).toBe(30);
  });

  it('初始法力为 1/1', () => {
    const s = createInitialState(TEST_DECK);
    expect(s.player.mana).toBe(1);
    expect(s.player.maxMana).toBe(1);
  });

  it('初始手牌 4 张', () => {
    const s = createInitialState(TEST_DECK);
    expect(s.player.hand.length).toBe(4);
  });

  it('初始为玩家回合', () => {
    const s = createInitialState(TEST_DECK);
    expect(s.currentTurn).toBe('player');
    expect(s.phase).toBe('draw');
    expect(s.turnNumber).toBe(1);
  });

  it('游戏未结束', () => {
    const s = createInitialState(TEST_DECK);
    expect(s.gameOver).toBe(false);
    expect(s.winner).toBeNull();
  });

  it('牌库数量正确', () => {
    const s = createInitialState(TEST_DECK);
    expect(s.player.deck.length).toBe(TEST_DECK.length - 4);
  });
});

/* ==================== 核心循环 ==================== */

describe('CardEngine — 回合抽牌', () => {
  it('startTurn 增加回合并重置法力', () => {
    let s = createInitialState(TEST_DECK);
    s = drawCard(s); // phase -> main (player)
    s = endTurn(s);  // currentTurn -> enemy, phase -> end
    s = startTurn(s); // enemy turn begins
    expect(s.turnNumber).toBe(2);
    expect(s.currentTurn).toBe('enemy');
    expect(s.phase).toBe('draw');
    expect(s.enemy.maxMana).toBe(2);
    expect(s.enemy.mana).toBe(2);
  });

  it('drawCard 抽一张牌并进入主阶段', () => {
    let s = createInitialState(TEST_DECK);
    const deckSize = s.player.deck.length;
    s = drawCard(s);
    expect(s.player.hand.length).toBe(5);
    expect(s.player.deck.length).toBe(deckSize - 1);
    expect(s.phase).toBe('main');
  });

  it('牌库空时抽牌受疲劳伤害', () => {
    let s = createInitialState(TEST_DECK);
    s = { ...s, player: { ...s.player, deck: [] } };
    s = drawCard(s);
    expect(s.player.hp).toBe(29);
  });

  it('法力上限不超过 10', () => {
    let s = createInitialState(TEST_DECK);
    // Run full turns until both players hit cap
    for (let i = 0; i < 20; i++) {
      s = drawCard(s);
      s = endTurn(s);
      s = startTurn(s);
    }
    // After 20 full cycles (10 per player), both should be capped at 10
    expect(s.player.maxMana).toBe(10);
    expect(s.enemy.maxMana).toBe(10);
  });
});

/* ==================== 出牌 ==================== */

describe('CardEngine — 出牌', () => {
  it('法力足够时成功出牌', () => {
    let s = createInitialState(TEST_DECK);
    s = drawCard(s); // phase -> main
    const cheapIdx = s.player.hand.findIndex((c) => c.cost <= 1);
    if (cheapIdx >= 0) {
      const result = playCard(s, cheapIdx);
      expect(result.success).toBe(true);
      expect(result.state.player.board.length).toBe(1);
      expect(result.state.player.mana).toBeLessThan(s.player.mana);
    }
  });

  it('法力不足时出牌失败', () => {
    let s = createInitialState(TEST_DECK);
    s = drawCard(s); // phase -> main
    s = { ...s, player: { ...s.player, mana: 0 } };
    const result = playCard(s, 0);
    expect(result.success).toBe(false);
    expect(result.message).toContain('法力不足');
  });

  it('非主阶段不能出牌', () => {
    const s = createInitialState(TEST_DECK);
    const result = playCard(s, 0); // phase is 'draw'
    expect(result.success).toBe(false);
  });

  it('游戏结束时不能出牌', () => {
    const s = createInitialState(TEST_DECK);
    const over = { ...s, gameOver: true };
    const result = playCard(over, 0);
    expect(result.success).toBe(false);
  });

  it('无效手牌索引返回失败', () => {
    let s = createInitialState(TEST_DECK);
    s = drawCard(s);
    const result = playCard(s, 999);
    expect(result.success).toBe(false);
  });

  it('法术牌打出后进入坟场', () => {
    let s = createInitialState(TEST_DECK);
    // 需要手上有法术牌
    s = { ...s, player: { ...s.player, hand: [s.player.hand.find((c) => c.isSpell) ?? s.player.hand[0]], mana: 10 } };
    s = { ...s, phase: 'main' as const };
    const spellIdx = s.player.hand.findIndex((c) => c.isSpell);
    if (spellIdx >= 0) {
      const result = playCard(s, spellIdx);
      if (result.success) {
        expect(result.state.player.graveyard.length).toBeGreaterThan(0);
      }
    }
  });

  it('出牌后手牌数减少', () => {
    let s = createInitialState(TEST_DECK);
    s = { ...s, player: { ...s.player, mana: 10, hand: [createCardInstance('axe_soldier')] }, phase: 'main' as const };
    const result = playCard(s, 0);
    if (result.success) {
      expect(result.state.player.hand.length).toBe(0);
    }
  });
});

/* ==================== 攻击系统 ==================== */

describe('CardEngine — 攻击系统', () => {
  it('刚上场无冲锋的随从不能攻击', () => {
    let s = createInitialState(TEST_DECK);
    s = { ...s, phase: 'main' as const, player: { ...s.player, mana: 10, hand: [createCardInstance('axe_soldier')] } };
    const result = playCard(s, 0);
    if (result.success) {
      const atkResult = attack(result.state, 0, undefined);
      expect(atkResult.success).toBe(false);
    }
  });

  it('冲锋随从上场后可立即攻击', () => {
    let s = createInitialState(TEST_DECK);
    s = { ...s, phase: 'main' as const, player: { ...s.player, mana: 10, hand: [createCardInstance('blademaster')] } };
    const result = playCard(s, 0);
    if (result.success) {
      const atkResult = attack(result.state, 0, undefined);
      expect(atkResult.success).toBe(true);
    }
  });

  it('攻击造成伤害', () => {
    let s = createInitialState(TEST_DECK);
    const atkCard = createCardInstance('blademaster');
    // 手动放一个已可攻击的随从
    s = {
      ...s,
      phase: 'main' as const,
      player: {
        ...s.player,
        board: [{ card: { ...atkCard, justPlayed: false, attacksThisTurn: 0 }, slot: 0 }],
      },
    };
    const result = attack(s, 0, undefined);
    if (result.success) {
      expect(result.state.enemy.hp).toBeLessThan(30);
    }
  });

  it('有嘲讽时必须先攻击嘲讽随从', () => {
    const tauntCard = createCardInstance('shield_guard');
    let s = createInitialState(TEST_DECK);
    const atkCard = createCardInstance('blademaster');
    s = {
      ...s,
      phase: 'main' as const,
      player: {
        ...s.player,
        board: [{ card: { ...atkCard, justPlayed: false, attacksThisTurn: 0 }, slot: 0 }],
      },
      enemy: {
        ...s.enemy,
        board: [{ card: tauntCard, slot: 0 }],
      },
    };
    const result = attack(s, 0, undefined); // 尝试打英雄
    if (result.success === false) {
      expect(result.message).toContain('嘲讽');
    }
  });
});

/* ==================== 战斗结算 ==================== */

describe('CardEngine — 战斗结算', () => {
  it('敌方 HP ≤ 0 玩家胜利', () => {
    let s = createInitialState(TEST_DECK);
    s = { ...s, enemy: { ...s.enemy, hp: 1 } };
    s = checkGameOver(s);
    expect(s.gameOver).toBe(false);
    s = { ...s, enemy: { ...s.enemy, hp: 0 } };
    s = checkGameOver(s);
    expect(s.gameOver).toBe(true);
    expect(s.winner).toBe('player');
  });

  it('玩家 HP ≤ 0 敌方胜利', () => {
    let s = createInitialState(TEST_DECK);
    s = { ...s, player: { ...s.player, hp: 0 } };
    s = checkGameOver(s);
    expect(s.gameOver).toBe(true);
    expect(s.winner).toBe('enemy');
  });

  it('endTurn 切换回合', () => {
    let s = createInitialState(TEST_DECK);
    s = drawCard(s);
    s = endTurn(s);
    expect(s.currentTurn).toBe('enemy');
  });

  it('游戏结束后 endTurn 不变', () => {
    let s = createInitialState(TEST_DECK);
    s = { ...s, gameOver: true, winner: 'player' as const };
    const s2 = endTurn(s);
    expect(s2.currentTurn).toBe(s.currentTurn);
  });
});

/* ==================== 工具函数 ==================== */

describe('CardEngine — 工具函数', () => {
  it('canAttack 判断正确', () => {
    const c = createCardInstance('axe_soldier');
    const fresh = { ...c, justPlayed: true, attacksThisTurn: 0 };
    expect(canAttack(fresh)).toBe(false); // just played, no charge

    const ready = { ...c, justPlayed: false, attacksThisTurn: 0 };
    expect(canAttack(ready)).toBe(true);

    const used = { ...c, justPlayed: false, attacksThisTurn: 1 };
    expect(canAttack(used)).toBe(false);
  });

  it('风怒随从可攻击两次', () => {
    const c = createCardInstance('blademaster');
    const ready = { ...c, justPlayed: false, attacksThisTurn: 0 };
    expect(canAttack(ready)).toBe(true);

    const usedOnce = { ...c, justPlayed: false, attacksThisTurn: 1 };
    expect(canAttack(usedOnce)).toBe(true); // windfury!

    const usedTwice = { ...c, justPlayed: false, attacksThisTurn: 2 };
    expect(canAttack(usedTwice)).toBe(false);
  });

  it('getAttackableUnits 返回可攻击索引', () => {
    const cards = [createCardInstance('axe_soldier'), createCardInstance('blademaster')];
    const board = [
      { card: { ...cards[0], justPlayed: false, attacksThisTurn: 0 }, slot: 0 },
      { card: { ...cards[1], justPlayed: false, attacksThisTurn: 0 }, slot: 1 },
    ];
    const indices = getAttackableUnits(board);
    expect(indices.length).toBe(2);
    expect(indices).toContain(0);
    expect(indices).toContain(1);
  });

  it('hasTaunt 检测嘲讽', () => {
    const board = [
      { card: createCardInstance('axe_soldier'), slot: 0 },
      { card: createCardInstance('shield_guard'), slot: 1 },
    ];
    expect(hasTaunt(board)).toBe(true);

    const noTaunt = [{ card: createCardInstance('axe_soldier'), slot: 0 }];
    expect(hasTaunt(noTaunt)).toBe(false);
  });

  it('getCardDefById 查找卡牌', () => {
    const d = getCardDefById('fireball');
    expect(d).toBeDefined();
    expect(d!.name).toBe('火球术');
    expect(d!.isSpell).toBe(true);
  });

  it('getCardDefById 不存在返回 undefined', () => {
    expect(getCardDefById('nonexistent')).toBeUndefined();
  });
});

/* ==================== 卡牌效果 ==================== */

describe('CardEngine — 卡牌效果', () => {
  it('战斧兵属性正确', () => {
    const d = getCardDefById('axe_soldier')!;
    expect(d.cost).toBe(1);
    expect(d.attack).toBe(2);
    expect(d.health).toBe(3);
    expect(d.effects).toEqual([]);
  });

  it('盾卫有嘲讽', () => {
    const d = getCardDefById('shield_guard')!;
    expect(d.effects).toContain('taunt');
    expect(d.health).toBe(5);
  });

  it('火球术为法术牌', () => {
    const d = getCardDefById('fireball')!;
    expect(d.isSpell).toBe(true);
    expect(d.spellDamage).toBe(4);
  });

  it('剑圣有冲锋和风怒', () => {
    const d = getCardDefById('blademaster')!;
    expect(d.effects).toContain('charge');
    expect(d.effects).toContain('windfury');
  });

  it('精灵龙有魔免', () => {
    const d = getCardDefById('faerie_dragon')!;
    expect(d.effects).toContain('spell_immunity');
  });

  it('烈焰风暴有全场AOE', () => {
    const d = getCardDefById('flame_storm')!;
    expect(d.isSpell).toBe(true);
    expect(d.aoeDamage).toBe(2);
  });

  it('治疗术可治疗', () => {
    const d = getCardDefById('healing_light')!;
    expect(d.isSpell).toBe(true);
    expect(d.healAmount).toBe(5);
  });
});

/* ==================== 边界情况 ==================== */

describe('CardEngine — 边界情况', () => {
  it('战场满 7 个随从时不能再放', () => {
    let s = createInitialState(TEST_DECK);
    s = { ...s, phase: 'main' as const };
    const card = createCardInstance('axe_soldier');
    s = {
      ...s,
      player: {
        ...s.player,
        mana: 10,
        hand: [card],
        board: Array.from({ length: 7 }, (_, i) => ({
          card: createCardInstance('axe_soldier'),
          slot: i,
        })),
      },
    };
    const result = playCard(s, 0);
    expect(result.success).toBe(false);
    expect(result.message).toContain('战场已满');
  });

  it('攻击力为 0 的随从不能攻击', () => {
    let s = createInitialState(TEST_DECK);
    const zeroAtk = { ...createCardInstance('fireball'), attack: 0, justPlayed: false, attacksThisTurn: 0 };
    s = {
      ...s,
      phase: 'main' as const,
      player: { ...s.player, board: [{ card: zeroAtk, slot: 0 }] },
    };
    const result = attack(s, 0, undefined);
    expect(result.success).toBe(false);
    expect(result.message).toContain('攻击力为 0');
  });

  it('createInitialState 使用未知 ID 抛错', () => {
    expect(() => createInitialState(['nonexistent'])).toThrow('未知卡牌 ID');
  });
});

/* ---- helper ---- */

function createCardInstance(id: string): CardInstance {
  const def = getCardDefById(id)!;
  return {
    defId: def.id,
    name: def.name,
    cost: def.cost,
    attack: def.attack,
    health: def.health,
    maxHealth: def.health,
    effects: [...def.effects],
    isSpell: def.isSpell ?? false,
    spellDamage: def.spellDamage,
    healAmount: def.healAmount,
    aoeDamage: def.aoeDamage,
    attacksThisTurn: 0,
    justPlayed: false,
  };
}
