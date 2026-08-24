import type { Stats } from "./content";

export interface Combatant {
  name: string;
  hp: number;
  stats: Stats;
  cooldown: number;
}

export interface HitResult {
  attacker: "player" | "enemy";
  damage: number;
  crit: boolean;
}

export function rollDamage(attacker: Stats, defender: Stats): { damage: number; crit: boolean } {
  const crit = Math.random() < attacker.crit;
  const variance = 0.85 + Math.random() * 0.3;
  const raw = attacker.atk * variance * (crit ? 1.8 : 1);
  const mitigated = raw * (100 / (100 + defender.def * 6));
  return { damage: Math.max(1, Math.round(mitigated)), crit };
}

/**
 * Advance an auto-battle by dt seconds. Mutates combatants, returns hits landed.
 */
export function tickCombat(player: Combatant, enemy: Combatant, dt: number): HitResult[] {
  const hits: HitResult[] = [];
  if (player.hp <= 0 || enemy.hp <= 0) return hits;

  player.cooldown -= dt * player.stats.speed;
  enemy.cooldown -= dt * enemy.stats.speed;

  if (player.cooldown <= 0) {
    player.cooldown += 1;
    const { damage, crit } = rollDamage(player.stats, enemy.stats);
    enemy.hp = Math.max(0, enemy.hp - damage);
    hits.push({ attacker: "player", damage, crit });
  }
  if (enemy.hp > 0 && enemy.cooldown <= 0) {
    enemy.cooldown += 1;
    const { damage, crit } = rollDamage(enemy.stats, player.stats);
    player.hp = Math.max(0, player.hp - damage);
    hits.push({ attacker: "enemy", damage, crit });
  }
  return hits;
}
