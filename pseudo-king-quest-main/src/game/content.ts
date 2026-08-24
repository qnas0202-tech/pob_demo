export type Slot = "weapon" | "armor" | "charm";

export interface Equipment {
  id: string;
  name: string;
  slot: Slot;
  tier: 1 | 2 | 3;
  atk: number;
  def: number;
  hp: number;
  speed: number; // attacks per second modifier
  crit: number; // 0..1
  price: number;
}

export const EQUIPMENT: Equipment[] = [
  { id: "w1", name: "녹슨 단검", slot: "weapon", tier: 1, atk: 6, def: 0, hp: 0, speed: 0.25, crit: 0.05, price: 20 },
  { id: "w2", name: "강철 장검", slot: "weapon", tier: 2, atk: 12, def: 1, hp: 0, speed: 0.1, crit: 0.08, price: 55 },
  { id: "w3", name: "왕가의 대검", slot: "weapon", tier: 3, atk: 20, def: 2, hp: 5, speed: 0, crit: 0.15, price: 110 },
  { id: "a1", name: "가죽 갑옷", slot: "armor", tier: 1, atk: 0, def: 3, hp: 10, speed: 0, crit: 0, price: 20 },
  { id: "a2", name: "사슬 갑옷", slot: "armor", tier: 2, atk: 0, def: 7, hp: 22, speed: -0.05, crit: 0, price: 55 },
  { id: "a3", name: "용린 판금", slot: "armor", tier: 3, atk: 2, def: 12, hp: 40, speed: -0.1, crit: 0, price: 110 },
  { id: "c1", name: "토끼발 부적", slot: "charm", tier: 1, atk: 1, def: 1, hp: 6, speed: 0.1, crit: 0.03, price: 20 },
  { id: "c2", name: "핏빛 룬석", slot: "charm", tier: 2, atk: 4, def: 2, hp: 10, speed: 0.15, crit: 0.07, price: 55 },
  { id: "c3", name: "왕의 인장", slot: "charm", tier: 3, atk: 7, def: 5, hp: 20, speed: 0.25, crit: 0.12, price: 110 },
];

export function randomEquipment(maxTier: number): Equipment {
  const pool = EQUIPMENT.filter((e) => e.tier <= maxTier);
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export interface Stats {
  atk: number;
  def: number;
  maxHp: number;
  speed: number;
  crit: number;
}

export const BASE_STATS: Stats = { atk: 8, def: 2, maxHp: 60, speed: 1, crit: 0.05 };

export type Loadout = Partial<Record<Slot, Equipment>>;

export function computeStats(loadout: Loadout, level: number): Stats {
  const s: Stats = {
    atk: BASE_STATS.atk + (level - 1) * 3,
    def: BASE_STATS.def + (level - 1) * 1.5,
    maxHp: BASE_STATS.maxHp + (level - 1) * 15,
    speed: BASE_STATS.speed,
    crit: BASE_STATS.crit,
  };
  for (const item of Object.values(loadout)) {
    if (!item) continue;
    s.atk += item.atk;
    s.def += item.def;
    s.maxHp += item.hp;
    s.speed += item.speed;
    s.crit += item.crit;
  }
  return s;
}

export type EnemyKind = "goblin" | "skeleton" | "orc";

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  stats: Stats;
  gold: number;
  boss: boolean;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  goblin: {
    kind: "goblin",
    name: "고블린",
    stats: { atk: 9, def: 2, maxHp: 45, speed: 1.2, crit: 0.05 },
    gold: 25,
    boss: false,
  },
  skeleton: {
    kind: "skeleton",
    name: "스켈레톤",
    stats: { atk: 14, def: 6, maxHp: 70, speed: 0.9, crit: 0.08 },
    gold: 45,
    boss: false,
  },
  orc: {
    kind: "orc",
    name: "오크 군주",
    stats: { atk: 22, def: 10, maxHp: 160, speed: 0.8, crit: 0.12 },
    gold: 150,
    boss: true,
  },
};
