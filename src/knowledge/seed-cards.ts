/**
 * Knowledge Card Seed Data — T3-M2
 *
 * 首批 20 张游戏开发领域知识卡片，覆盖 7 大领域。
 */

import type { KnowledgeCard } from '../memory-v2/types';

const TODAY = new Date('2026-06-21').getTime();

export const SEED_CARDS: KnowledgeCard[] = [
  /* ==================== 通用游戏架构 (4) ==================== */
  {
    id: 'kcard-001',
    source: 'web',
    title: 'ECS 实体组件系统模式',
    summary:
      'ECS（Entity-Component-System）是一种面向数据的设计模式，将游戏对象拆分为实体（ID）、组件（纯数据）和系统（纯逻辑）。相比传统 OOP 继承树，ECS 避免了菱形继承问题，天然支持组件组合和并行处理，在 Unity DOTS、EnTT 等框架中广泛使用。',
    tags: ['ecs', '架构', '游戏引擎', '设计模式'],
    url: 'https://github.com/skypjack/entt',
    lastVerified: TODAY,
    relevanceScore: 1.0,
  },
  {
    id: 'kcard-002',
    source: 'web',
    title: '组件化游戏架构设计',
    summary:
      '组件化架构（Component-Based Architecture）将游戏对象的行为拆分为独立可复用的组件模块。每个组件封装特定功能（渲染、物理、AI），通过消息或接口通信。这种松耦合设计使策划可通过数据驱动配置组合新玩法，无需程序员介入，是现代商业引擎（Unity/Unreal）的核心范式。',
    tags: ['组件化', '架构', '解耦', '数据驱动'],
    url: 'https://gameprogrammingpatterns.com/component.html',
    lastVerified: TODAY,
    relevanceScore: 1.0,
  },
  {
    id: 'kcard-003',
    source: 'manual',
    title: '有限状态机 (FSM) 设计',
    summary:
      '有限状态机是游戏逻辑控制的基础模式。每个状态定义 Enter/Update/Exit 三个生命周期回调，通过转换条件（Transition）连接。经典分层状态机（HFSM）支持子状态嵌套，适合处理角色动画状态、UI 流程、游戏回合等场景。实现时需注意避免状态爆炸和转换冲突。',
    tags: ['状态机', 'fsm', '游戏逻辑', '动画'],
    lastVerified: TODAY,
    relevanceScore: 1.0,
  },
  {
    id: 'kcard-004',
    source: 'web',
    title: '事件总线与消息系统',
    summary:
      '事件总线（Event Bus）实现发布-订阅模式，解耦游戏模块间的通信。模块通过事件类型订阅感兴趣的消息，发送者无需知道接收者身份。手游中常用于成就系统、任务追踪、UI 刷新等跨模块通知。实现时注意事件队列的优先级排序和内存泄漏（未取消订阅的观察者）。',
    tags: ['事件总线', '消息系统', '解耦', 'pub-sub'],
    url: 'https://gameprogrammingpatterns.com/observer.html',
    lastVerified: TODAY,
    relevanceScore: 1.0,
  },

  /* ==================== 渲染/图形 (3) ==================== */
  {
    id: 'kcard-005',
    source: 'web',
    title: '实时渲染管线概述',
    summary:
      '渲染管线分为应用阶段（CPU 剔除/合批）、几何阶段（顶点着色器/曲面细分/几何着色器/裁剪/屏幕映射）和光栅化阶段（三角形设置/遍历/像素着色器/合并）。手游 GPU（如 Mali/Adreno）采用 Tile-Based Rendering 架构，对 Draw Call 和带宽开销尤为敏感。',
    tags: ['渲染管线', '图形学', 'gpu', 'shader'],
    url: 'https://learnopengl.com/Getting-started/Hello-Triangle',
    lastVerified: TODAY,
    relevanceScore: 1.0,
  },
  {
    id: 'kcard-006',
    source: 'manual',
    title: '着色器基础：顶点与片元着色器',
    summary:
      '顶点着色器（Vertex Shader）逐顶点处理位置变换和属性传递；片元着色器（Fragment Shader）逐像素计算最终颜色。手游常用 GLSL/HLSL/Metal Shading Language。优化要点：减少纹理采样次数、避免动态分支、使用半精度（mediump）浮点数以适配移动 GPU。',
    tags: ['着色器', 'shader', 'glsl', '渲染'],
    lastVerified: TODAY,
    relevanceScore: 1.0,
  },
  {
    id: 'kcard-007',
    source: 'web',
    title: 'Draw Call 优化策略',
    summary:
      'Draw Call 是 CPU 向 GPU 发起的一次绘制指令。手游场景中 Draw Call 超过 100-200 即可能导致帧率下降。优化手段包括：静态/动态合批（Batching）、GPU Instancing、纹理图集（Texture Atlas）、SRP Batcher、遮挡剔除。减少材质种类和网格切换是降 Draw Call 的关键。',
    tags: ['draw-call', '优化', '性能', '合批'],
    url: 'https://docs.unity3d.com/Manual/DrawCallBatching.html',
    lastVerified: TODAY,
    relevanceScore: 1.0,
  },

  /* ==================== 物理/碰撞 (2) ==================== */
  {
    id: 'kcard-008',
    source: 'manual',
    title: '碰撞检测算法综述',
    summary:
      '碰撞检测分为粗筛（Broad Phase，使用空间划分如四叉树/八叉树/Sweep and Prune）和精测（Narrow Phase，几何求交）。手游因性能限制，常采用简化的碰撞体（球体/胶囊体/盒体）替代精确网格碰撞。物理引擎（Box2D/Bullet/PhysX）内置 SAT 和 GJK 算法处理凸体碰撞。',
    tags: ['碰撞检测', '物理', '算法', '空间划分'],
    lastVerified: TODAY,
    relevanceScore: 1.0,
  },
  {
    id: 'kcard-009',
    source: 'web',
    title: 'AABB vs GJK 碰撞算法对比',
    summary:
      'AABB（轴对齐包围盒）检测仅需 6 次比较运算，复杂度 O(1)，适合粗筛。GJK（Gilbert-Johnson-Keerthi）基于闵可夫斯基差和支撑函数，可检测任意凸体碰撞并返回穿透深度和方向，复杂度 O(n) 但常数较小。手游物理通常先 AABB 粗筛，再用 GJK/EPA 精测。',
    tags: ['aabb', 'gjk', '碰撞', '算法', '物理'],
    url: 'https://dyn4j.org/2010/04/gjk-gilbert-johnson-keerthi/',
    lastVerified: TODAY,
    relevanceScore: 1.0,
  },

  /* ==================== AI 系统 (3) ==================== */
  {
    id: 'kcard-010',
    source: 'web',
    title: '行为树 (Behavior Tree) 设计',
    summary:
      '行为树是游戏 AI 的主流决策架构，由控制节点（Sequence/Selector/Parallel）和叶节点（Action/Condition）组成。相比有限状态机，行为树支持模块化复用、可视化编辑和增量扩展。Tick 机制每帧从根节点遍历执行。手游中多用于怪物 AI、NPC 行为和自动战斗逻辑。',
    tags: ['行为树', 'ai', '决策', '游戏ai'],
    url: 'https://www.behaviortree.dev/',
    lastVerified: TODAY,
    relevanceScore: 1.0,
  },
  {
    id: 'kcard-011',
    source: 'web',
    title: 'GOAP 目标导向行动规划',
    summary:
      'GOAP（Goal-Oriented Action Planning）是一种基于规划的 AI 架构，Agent 根据当前世界状态和目标状态，通过 A* 搜索最佳行动序列。相比行为树，GOAP 的 Agent 行为更动态、更涌现，无需手动设计所有分支。适用于开放世界 NPC、战术 AI 等需要自适应行为的场景。',
    tags: ['goap', 'ai', '规划', '决策'],
    url: 'https://alumni.media.mit.edu/~jorkin/goap.html',
    lastVerified: TODAY,
    relevanceScore: 1.0,
  },
  {
    id: 'kcard-012',
    source: 'manual',
    title: 'A* 寻路算法与优化',
    summary:
      'A* 是游戏中最常用的网格寻路算法，结合 Dijkstra 的最短路径保证和贪心最佳优先的启发性。核心公式 f(n)=g(n)+h(n)，h(n) 常用曼哈顿或欧几里得距离。手游优化：分层寻路、导航网格（NavMesh）、路径平滑（Catmull-Rom/Funnel 算法）、多 Agent 避障的 ORCA 算法。',
    tags: ['a-star', '寻路', 'ai', '算法', 'navmesh'],
    lastVerified: TODAY,
    relevanceScore: 1.0,
  },

  /* ==================== 网络/联机 (3) ==================== */
  {
    id: 'kcard-013',
    source: 'web',
    title: '帧同步 vs 状态同步',
    summary:
      '帧同步（Lockstep）所有客户端执行相同逻辑帧，仅同步玩家输入，确定性要求极高（浮点数/随机数需一致），适合 RTS/MOBA。状态同步（State Sync）服务器计算权威状态并向客户端广播差异，容错性好但带宽占用高。手游联机中 MOBA 多用帧同步，MMO/吃鸡多用状态同步。',
    tags: ['帧同步', '状态同步', '网络', '联机'],
    url: 'https://gafferongames.com/post/state_synchronization/',
    lastVerified: TODAY,
    relevanceScore: 1.0,
  },
  {
    id: 'kcard-014',
    source: 'web',
    title: '客户端预测与服务器回滚',
    summary:
      '客户端预测（Client-Side Prediction）让玩家操作立即生效，服务器后续校验并回滚错误状态。结合服务器回滚（Server Reconciliation）和插值（Interpolation），可在高延迟下保证流畅体验。手游中需权衡预测激进程度和回滚频率，通常限制预测帧数在 3-5 帧内。',
    tags: ['预测', '回滚', '网络', '延迟补偿'],
    url: 'https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking',
    lastVerified: TODAY,
    relevanceScore: 1.0,
  },
  {
    id: 'kcard-015',
    source: 'manual',
    title: '房间匹配与大厅系统',
    summary:
      '手游联机房间系统分为大厅服务（房间列表/快速匹配/邀请码/天梯匹配）和游戏会话（创建/加入/离开/重连）。匹配算法常用 ELO/Glicko-2 评分进行实力均衡。断线重连需保存会话状态快照，重连后同步增量状态。Photon、Mirror、FishNet 等框架提供开箱即用的房间管理。',
    tags: ['房间', '匹配', '网络', '大厅', 'elo'],
    lastVerified: TODAY,
    relevanceScore: 1.0,
  },

  /* ==================== 性能优化 (3) ==================== */
  {
    id: 'kcard-016',
    source: 'web',
    title: '对象池模式与内存管理',
    summary:
      '对象池（Object Pool）预创建并回收游戏对象（子弹/特效/UI 条目），避免频繁 new/delete 导致的内存碎片和 GC 压力。手游中应特别注意：池容量上限防止内存膨胀、对象状态重置防脏数据泄漏、分级池按对象复杂度分开管理。Unity 中可用 ObjectPool<T> 泛型类实现。',
    tags: ['对象池', '内存', '优化', 'gc'],
    url: 'https://gameprogrammingpatterns.com/object-pool.html',
    lastVerified: TODAY,
    relevanceScore: 1.0,
  },
  {
    id: 'kcard-017',
    source: 'manual',
    title: 'LOD 层级细节策略',
    summary:
      'LOD（Level of Detail）根据物体与相机的距离动态切换模型精度。手游 LOD 策略涵盖：网格精简（Mesh LOD）、纹理 Mipmap、Shader LOD（远处用简化着色器）、阴影 LOD（远处投射低分辨率阴影或关闭）。配合 HLOD（层级 LOD）可将远处建筑群合并为单个低面模型。',
    tags: ['lod', '优化', '渲染', '性能'],
    lastVerified: TODAY,
    relevanceScore: 1.0,
  },
  {
    id: 'kcard-018',
    source: 'web',
    title: 'GC 友好编程实践',
    summary:
      'C# 手游（Unity/IL2CPP）需特别注意 GC 压力：避免每帧分配临时对象（用 struct 替代、缓存 List/Array）、字符串操作用 StringBuilder 或字符串池、协程中避免 yield return new WaitForSeconds（缓存 YieldInstruction）、事件订阅及时取消避免泄漏。使用 Unity Profiler 的 GC Alloc 列定位热点。',
    tags: ['gc', '优化', 'csharp', '内存', 'unity'],
    url: 'https://docs.unity3d.com/Manual/UnderstandingAutomaticMemoryManagement.html',
    lastVerified: TODAY,
    relevanceScore: 1.0,
  },

  /* ==================== 商业化设计 (2) ==================== */
  {
    id: 'kcard-019',
    source: 'web',
    title: '双货币经济系统设计',
    summary:
      '双货币（软货币+硬货币）是 F2P 手游的标准经济模型。软货币（金币）通过游戏行为大量产出，用于基础消耗；硬货币（钻石/元宝）稀缺，通过付费或有限活动获取，用于高级消费。需控制通胀、设计消耗出口、平衡两种货币的兑换比例，避免经济崩溃或付费墙。',
    tags: ['双货币', '商业化', '经济系统', 'f2p'],
    url: 'https://www.gamedeveloper.com/business/monetization-economy-design',
    lastVerified: TODAY,
    relevanceScore: 1.0,
  },
  {
    id: 'kcard-020',
    source: 'manual',
    title: '战令系统 (Battle Pass) 设计',
    summary:
      '战令系统是手游中提升留存和付费的核心机制之一。分为免费轨和付费轨，通过每日/每周任务积累经验升级获取奖励。设计要点：奖励梯度（前期高价值吸引付费、中后期维持投入感）、赛季周期（通常 4-8 周）、等级购买跳过机制。成功案例如 Fortnite/CODM/Genshin 的纪行系统。',
    tags: ['战令', 'battle-pass', '商业化', '留存'],
    lastVerified: TODAY,
    relevanceScore: 1.0,
  },
];

/** 获取种子卡片总数 */
export const SEED_CARD_COUNT = SEED_CARDS.length;

/** 获取所有卡片 ID 列表（用于验证） */
export const SEED_CARD_IDS = SEED_CARDS.map((c) => c.id);
