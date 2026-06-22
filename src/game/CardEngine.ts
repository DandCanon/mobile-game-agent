/* ===================================================================
 * CardEngine — 卡牌对战纯逻辑引擎
 *
 * 设计原则：
 *  - 所有函数为纯函数，接收 state 返回新 state
 *  - 回合流程：抽牌 → 主阶段（出牌）→ 战斗阶段 → 结束
 *  - 支持六种效果：战吼/亡语/冲锋/嘲讽/风怒/魔免
 *  - 法力水晶每回合 +1，上限 10
 * =================================================================== */

/* ==================== 类型定义 ==================== */

export type EffectType =
  | 'battlecry'
  | 'deathrattle'
  | 'charge'
  | 'taunt'
  | 'windfury'
  | 'spell_immunity';

export interface CardDef {
  id: string;
  name: string;
  cost: number;
  attack: number;
  health: number;
  effects: EffectType[];
  spellDamage?: number;
  healAmount?: number;
  aoeDamage?: number;
  isSpell?: boolean;
}

export interface CardInstance {
  defId: string;
  name: string;
  cost: number;
  attack: number;
  health: number;
  maxHealth: number;
  effects: EffectType[];
  isSpell: boolean;
  spellDamage?: number;
  healAmount?: number;
  aoeDamage?: number;
  attacksThisTurn: number;
  justPlayed: boolean;
}

export interface BoardUnit {
  card: CardInstance;
  slot: number;
}

export interface PlayerState {
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  hand: CardInstance[];
  board: BoardUnit[];
  deck: CardInstance[];
  graveyard: CardInstance[];
}

export interface CardGameState {
  player: PlayerState;
  enemy: PlayerState;
  currentTurn: 'player' | 'enemy';
  turnNumber: number;
  phase: 'draw' | 'main' | 'combat' | 'end';
  gameOver: boolean;
  winner: 'player' | 'enemy' | null;
}

/* ==================== 卡牌目录 ==================== */

function createCard(def: CardDef): CardInstance {
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

export const CARD_CATALOG: CardDef[] = [
  { id: 'axe_soldier',  name: '战斧兵',   cost: 1, attack: 2, health: 3, effects: [] },
  { id: 'shield_guard', name: '盾卫',     cost: 2, attack: 1, health: 5, effects: ['taunt'] },
  { id: 'fireball',     name: '火球术',   cost: 3, attack: 0, health: 0, effects: [], spellDamage: 4, isSpell: true },
  { id: 'healing_light',name: '治疗术',   cost: 2, attack: 0, health: 0, effects: [], healAmount: 5, isSpell: true },
  { id: 'blademaster',  name: '剑圣',     cost: 4, attack: 4, health: 3, effects: ['charge', 'windfury'] },
  { id: 'archer',       name: '弓箭手',   cost: 2, attack: 3, health: 2, effects: [] },
  { id: 'flame_storm',  name: '烈焰风暴', cost: 5, attack: 0, health: 0, effects: [], aoeDamage: 2, isSpell: true },
  { id: 'faerie_dragon',name: '精灵龙',   cost: 3, attack: 3, health: 3, effects: ['spell_immunity'] },
];

export function getCardDefById(id: string): CardDef | undefined {
  return CARD_CATALOG.find((c) => c.id === id);
}

/* ==================== 状态创建 ==================== */

const MAX_BOARD_SLOTS = 7;
const MAX_HAND_SIZE = 10;
const MAX_MANA = 10;
const STARTING_HP = 30;
const STARTING_HAND_SIZE = 4;

export function createInitialState(playerDeckIds: string[]): CardGameState {
  const buildDeck = (ids: string[]): CardInstance[] =>
    ids.map((id) => {
      const def = getCardDefById(id);
      if (!def) throw new Error('未知卡牌 ID: ' + id);
      return createCard(def);
    });

  const shuffle = <T>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const playerDeck = shuffle(buildDeck(playerDeckIds));
  const playerHand = playerDeck.splice(0, Math.min(STARTING_HAND_SIZE, playerDeck.length));

  return {
    player: {
      hp: STARTING_HP,
      maxHp: STARTING_HP,
      mana: 1,
      maxMana: 1,
      hand: playerHand,
      board: [],
      deck: playerDeck,
      graveyard: [],
    },
    enemy: {
      hp: STARTING_HP,
      maxHp: STARTING_HP,
      mana: 1,
      maxMana: 1,
      hand: [],
      board: [],
      deck: [],
      graveyard: [],
    },
    currentTurn: 'player',
    turnNumber: 1,
    phase: 'draw',
    gameOver: false,
    winner: null,
  };
}

/* ==================== 回合管理 ==================== */

export function startTurn(state: CardGameState): CardGameState {
  if (state.gameOver) return state;

  const next: CardGameState = {
    ...state,
    turnNumber: state.turnNumber + 1,
    phase: 'draw',
  };

  const activePlayer = next.currentTurn === 'player' ? 'player' : 'enemy';
  const passivePlayer = activePlayer === 'player' ? 'enemy' : 'player';
  const ap = { ...next[activePlayer] };
  const pp = { ...next[passivePlayer] };

  // 法力水晶增长
  ap.maxMana = Math.min(ap.maxMana + 1, MAX_MANA);
  ap.mana = ap.maxMana;

  // 重置随从攻击次数
  ap.board = ap.board.map((u) => ({
    ...u,
    card: { ...u.card, attacksThisTurn: 0, justPlayed: false },
  }));
  pp.board = pp.board.map((u) => ({
    ...u,
    card: { ...u.card, attacksThisTurn: 0, justPlayed: false },
  }));

  return {
    ...next,
    [activePlayer]: ap,
    [passivePlayer]: pp,
  };
}

export function drawCard(state: CardGameState): CardGameState {
  if (state.gameOver) return state;
  if (state.phase !== 'draw') return state;

  const activePlayer = state.currentTurn === 'player' ? 'player' : 'enemy';
  const ap = { ...state[activePlayer] };

  if (ap.deck.length === 0) {
    // 疲劳伤害：牌库为空时受到伤害
    return {
      ...state,
      [activePlayer]: { ...ap, hp: ap.hp - 1 },
      phase: 'main',
      gameOver: ap.hp <= 1 ? true : state.gameOver,
      winner: ap.hp <= 1 ? (activePlayer === 'player' ? 'enemy' : 'player') : null,
    };
  }

  if (ap.hand.length >= MAX_HAND_SIZE) {
    // 手牌满，抽到的牌直接弃掉
    const burnt = ap.deck[0];
    return {
      ...state,
      [activePlayer]: {
        ...ap,
        deck: ap.deck.slice(1),
        graveyard: [...ap.graveyard, burnt],
      },
      phase: 'main',
    };
  }

  const drawn = ap.deck[0];
  return {
    ...state,
    [activePlayer]: {
      ...ap,
      deck: ap.deck.slice(1),
      hand: [...ap.hand, drawn],
    },
    phase: 'main',
  };
}

/* ==================== 出牌 ==================== */

export interface PlayCardResult {
  state: CardGameState;
  success: boolean;
  message?: string;
}

export function playCard(
  state: CardGameState,
  handIndex: number,
  targetSlot?: number,
): PlayCardResult {
  if (state.gameOver) return { state, success: false, message: '游戏已结束' };
  if (state.phase !== 'main') return { state, success: false, message: '当前不是主阶段' };

  const activePlayer = state.currentTurn === 'player' ? 'player' : 'enemy';
  const passivePlayer = activePlayer === 'player' ? 'enemy' : 'player';
  const ap = { ...state[activePlayer] };
  const pp = { ...state[passivePlayer] };

  if (handIndex < 0 || handIndex >= ap.hand.length) {
    return { state, success: false, message: '无效的手牌索引' };
  }

  const card = ap.hand[handIndex];
  if (card.cost > ap.mana) {
    return { state, success: false, message: '法力不足' };
  }

  if (!card.isSpell && ap.board.length >= MAX_BOARD_SLOTS) {
    return { state, success: false, message: '战场已满' };
  }

  // 扣除法力
  ap.mana -= card.cost;

  // 从手牌移除
  const newHand = [...ap.hand];
  newHand.splice(handIndex, 1);
  ap.hand = newHand;

  if (card.isSpell) {
    // 法术：立即结算效果后进入坟场
    let resultState: CardGameState = {
      ...state,
      [activePlayer]: ap,
      [passivePlayer]: pp,
    };
    resultState = executeSpellEffect(resultState, card, activePlayer, passivePlayer);
    const resultAp = { ...resultState[activePlayer] };
    resultAp.graveyard = [...resultAp.graveyard, card];
    return {
      state: checkGameOver({
        ...resultState,
        [activePlayer]: resultAp,
      }),
      success: true,
    };
  }

  // 随从：放置到战场
  const slot = targetSlot ?? ap.board.length;
  const playedCard: CardInstance = { ...card, justPlayed: true, attacksThisTurn: 0 };

  // 冲锋随从可立即攻击
  if (playedCard.effects.includes('charge')) {
    playedCard.attacksThisTurn = 0;
  }

  const newBoard = [...ap.board];
  // 在指定位置插入（简化：直接追加）
  newBoard.push({ card: playedCard, slot });

  ap.board = newBoard;

  let resultState: CardGameState = {
    ...state,
    [activePlayer]: ap,
    [passivePlayer]: pp,
  };

  // 战吼效果
  if (playedCard.effects.includes('battlecry')) {
    resultState = executeBattlecry(resultState, playedCard, activePlayer, passivePlayer);
  }

  return {
    state: checkGameOver(resultState),
    success: true,
  };
}

function executeSpellEffect(
  state: CardGameState,
  card: CardInstance,
  caster: 'player' | 'enemy',
  target: 'player' | 'enemy',
): CardGameState {
  const pp = { ...state[target] };
  const cp = { ...state[caster] };

  // 直接伤害
  if (card.spellDamage) {
    // 检查目标是否有魔免随从（对敌方英雄伤害时）
    const hasSpellImmune = pp.board.some((u) => u.card.effects.includes('spell_immunity'));
    if (!hasSpellImmune) {
      pp.hp = Math.max(0, pp.hp - card.spellDamage);
    }
  }

  // 治疗
  if (card.healAmount) {
    cp.hp = Math.min(cp.maxHp, cp.hp + card.healAmount);
  }

  // 全场 AOE
  if (card.aoeDamage) {
    const aoe = card.aoeDamage;
    pp.board = pp.board
      .map((u) => {
        if (u.card.effects.includes('spell_immunity')) return u;
        const newHp = u.card.health - aoe;
        return newHp <= 0 ? null : { ...u, card: { ...u.card, health: newHp } };
      })
      .filter((u): u is BoardUnit => u !== null);
  }

  return {
    ...state,
    [caster]: cp,
    [target]: pp,
  };
}

function executeBattlecry(
  state: CardGameState,
  _card: CardInstance,
  caster: 'player' | 'enemy',
  target: 'player' | 'enemy',
): CardGameState {
  // 通用战吼简化处理：对敌方英雄造成 1 点伤害
  let pp = { ...state[target] };
  pp = { ...pp, hp: Math.max(0, pp.hp - 1) };
  return { ...state, [target]: pp };
}

/* ==================== 攻击 ==================== */

export interface AttackResult {
  state: CardGameState;
  success: boolean;
  message?: string;
}

export function attack(
  state: CardGameState,
  attackerIndex: number,
  targetIndex?: number,
): AttackResult {
  if (state.gameOver) return { state, success: false, message: '游戏已结束' };
  if (state.phase !== 'main' && state.phase !== 'combat') {
    return { state, success: false, message: '当前阶段不能攻击' };
  }

  const activePlayer = state.currentTurn === 'player' ? 'player' : 'enemy';
  const passivePlayer = activePlayer === 'player' ? 'enemy' : 'player';
  const ap = { ...state[activePlayer] };
  const pp = { ...state[passivePlayer] };

  if (attackerIndex < 0 || attackerIndex >= ap.board.length) {
    return { state, success: false, message: '无效的攻击者索引' };
  }

  const attacker = ap.board[attackerIndex];
  const attackerCard = attacker.card;

  // 刚上场的随从（无冲锋）不能攻击
  if (attackerCard.justPlayed && !attackerCard.effects.includes('charge')) {
    return { state, success: false, message: '该随从本回合无法攻击' };
  }

  // 风怒：最多攻击 2 次
  const maxAttacks = attackerCard.effects.includes('windfury') ? 2 : 1;
  if (attackerCard.attacksThisTurn >= maxAttacks) {
    return { state, success: false, message: '该随从本回合攻击次数已用完' };
  }

  // 攻击力为 0 不能攻击
  if (attackerCard.attack <= 0) {
    return { state, success: false, message: '该随从攻击力为 0' };
  }

  // 确定目标：如果有嘲讽随从必须优先攻击
  if (targetIndex === undefined) {
    // 攻击敌方英雄
    const taunts = pp.board.filter((u) => u.card.effects.includes('taunt'));
    if (taunts.length > 0) {
      const tauntNames = taunts.map((t) => t.card.name).join('、');
      return { state, success: false, message: '必须先攻击嘲讽随从: ' + tauntNames };
    }
    // 攻击英雄
    pp.hp = Math.max(0, pp.hp - attackerCard.attack);
  } else {
    if (targetIndex < 0 || targetIndex >= pp.board.length) {
      return { state, success: false, message: '无效的目标索引' };
    }

    const target = pp.board[targetIndex];
    const targetCard = target.card;

    // 双方互相造成伤害
    const attackerNewHp = attackerCard.health - targetCard.attack;
    const targetNewHp = targetCard.health - attackerCard.attack;

    // 更新攻方
    if (attackerNewHp <= 0) {
      // 攻击者死亡
      ap.board = ap.board.filter((_, i) => i !== attackerIndex);
      ap.graveyard = [...ap.graveyard, { ...attackerCard, health: 0 }];
      // 亡语触发（简化：对敌方英雄造成 1 点伤害）
      if (attackerCard.effects.includes('deathrattle')) {
        pp.hp = Math.max(0, pp.hp - 1);
      }
    } else {
      ap.board[attackerIndex] = {
        ...attacker,
        card: { ...attackerCard, health: attackerNewHp, attacksThisTurn: attackerCard.attacksThisTurn + 1, justPlayed: false },
      };
    }

    // 更新目标
    if (targetNewHp <= 0) {
      pp.board = pp.board.filter((_, i) => i !== targetIndex);
      pp.graveyard = [...pp.graveyard, { ...targetCard, health: 0 }];
      if (targetCard.effects.includes('deathrattle')) {
        ap.hp = Math.max(0, ap.hp - 1);
      }
    } else {
      pp.board[targetIndex] = {
        ...target,
        card: { ...targetCard, health: targetNewHp },
      };
    }
  }

  return {
    state: checkGameOver({
      ...state,
      [activePlayer]: ap,
      [passivePlayer]: pp,
    }),
    success: true,
  };
}

/* ==================== 结束回合 ==================== */

export function endTurn(state: CardGameState): CardGameState {
  if (state.gameOver) return state;

  const nextCurrentTurn: 'player' | 'enemy' =
    state.currentTurn === 'player' ? 'enemy' : 'player';

  return checkGameOver({
    ...state,
    currentTurn: nextCurrentTurn,
    phase: 'end',
  });
}

/* ==================== 胜负判定 ==================== */

export function checkGameOver(state: CardGameState): CardGameState {
  if (state.gameOver) return state;

  if (state.player.hp <= 0) {
    return { ...state, gameOver: true, winner: 'enemy' };
  }
  if (state.enemy.hp <= 0) {
    return { ...state, gameOver: true, winner: 'player' };
  }
  return state;
}

/* ==================== 实用函数 ==================== */

export function canAttack(card: CardInstance): boolean {
  if (card.attack <= 0) return false;
  const maxAttacks = card.effects.includes('windfury') ? 2 : 1;
  if (card.attacksThisTurn >= maxAttacks) return false;
  if (card.justPlayed && !card.effects.includes('charge')) return false;
  return true;
}

export function getAttackableUnits(board: BoardUnit[]): number[] {
  return board
    .map((u, i) => (canAttack(u.card) ? i : -1))
    .filter((i) => i >= 0);
}

export function hasTaunt(board: BoardUnit[]): boolean {
  return board.some((u) => u.card.effects.includes('taunt'));
}
