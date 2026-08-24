import type { EnemyKind } from "./content";

export type NodeKind = "fork" | "treasure" | "merchant" | "combat" | "boss" | "turn";

export interface Tail {
  /**
   * Cells continuing the path after a turn junction.
   * path[0] is the first cell of the branch, adjacent to the junction cell.
   */
  path: Cell[];
  /** nodes on this branch; pathIndex is absolute for the spliced combined path */
  nodes: DungeonNode[];
}

export interface DungeonNode {
  kind: NodeKind;
  /** index into the path cells where the player stops */
  pathIndex: number;
  enemy?: EnemyKind;
  tier?: number;
  /** branches for "turn" nodes — exactly one is picked by the player */
  left?: Tail;
  right?: Tail;
}

export interface Cell {
  x: number;
  y: number;
}

export interface Dungeon {
  grid: Uint8Array;
  size: number;
  path: Cell[];
  nodes: DungeonNode[];
}

const DIRS: Cell[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

function rnd(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Node sequence for the prototype run (10 stops, whichever branch is taken). */
const NODE_SEQUENCE: NodeKind[] = [
  "fork",
  "combat",
  "treasure",
  "turn",
  "combat",
  "merchant",
  "turn",
  "combat",
  "treasure",
  "boss",
];

const ENEMY_BY_INDEX: EnemyKind[] = ["goblin", "goblin", "skeleton"];

interface KindEntry {
  kind: NodeKind;
  seq: number;
}

export function generateDungeon(): Dungeon {
  const size = 96;
  const grid = new Uint8Array(size * size).fill(1);

  const carve = (x: number, y: number) => {
    grid[y * size + x] = 0;
  };
  const inBounds = (x: number, y: number) => x > 1 && y > 1 && x < size - 2 && y < size - 2;

  /** widen a stop into a small chamber so it reads as a room */
  const carveChamber = (cx: number, cy: number) => {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (inBounds(cx + dx, cy + dy)) carve(cx + dx, cy + dy);
      }
    }
  };

  let combatCount = 0;
  const makeNode = (kind: NodeKind, seq: number, pathIndex: number): DungeonNode => {
    const node: DungeonNode = { kind, pathIndex };
    if (kind === "combat") {
      node.enemy = ENEMY_BY_INDEX[Math.min(combatCount, ENEMY_BY_INDEX.length - 1)]!;
      combatCount++;
    }
    if (kind === "boss") node.enemy = "orc";
    if (kind === "treasure") node.tier = seq < 5 ? 1 : 2;
    return node;
  };

  /** walk straight from (cx,cy) along dir, carving and appending cells; returns end position */
  const walk = (cx: number, cy: number, dir: number, steps: number, out: Cell[]) => {
    for (let i = 0; i < steps; i++) {
      const d = DIRS[dir]!;
      const nx = cx + d.x;
      const ny = cy + d.y;
      if (!inBounds(nx, ny)) break;
      cx = nx;
      cy = ny;
      carve(cx, cy);
      out.push({ x: cx, y: cy });
    }
    return { x: cx, y: cy };
  };

  /**
   * Build a branch leaving a junction at (sx,sy) facing `dir`.
   * absBase = absolute path index of the starting cell in the combined path.
   * Both branches are carved into the shared grid, so the road not taken
   * remains visible as a side passage.
   */
  const buildTail = (sx: number, sy: number, dir: number, entries: KindEntry[], absBase: number): Tail => {
    const path: Cell[] = [{ x: sx, y: sy }];
    const nodes: DungeonNode[] = [];
    let cx = sx;
    let cy = sy;

    for (let e = 0; e < entries.length; e++) {
      const pos = walk(cx, cy, dir, rnd(4, 7), path);
      cx = pos.x;
      cy = pos.y;
      const abs = absBase + path.length - 1;
      const { kind, seq } = entries[e]!;

      if (kind === "turn") {
        const node = makeNode(kind, seq, abs);
        carveChamber(cx, cy);
        const leftDir = (dir + 3) % 4;
        const rightDir = (dir + 1) % 4;
        const lx = cx + DIRS[leftDir]!.x;
        const ly = cy + DIRS[leftDir]!.y;
        const rx = cx + DIRS[rightDir]!.x;
        const ry = cy + DIRS[rightDir]!.y;
        carve(lx, ly);
        carve(rx, ry);
        node.left = buildTail(lx, ly, leftDir, entries.slice(e + 1), abs + 1);
        node.right = buildTail(rx, ry, rightDir, entries.slice(e + 1), abs + 1);
        nodes.push(node);
        return { path, nodes };
      }

      nodes.push(makeNode(kind, seq, abs));
      carveChamber(cx, cy);
    }
    return { path, nodes };
  };

  // main trunk: straight north from the entrance
  const startX = Math.floor(size / 2);
  const startY = size - 4;
  carve(startX, startY);
  const path: Cell[] = [{ x: startX, y: startY }];
  const nodes: DungeonNode[] = [];
  let cx = startX;
  let cy = startY;
  const entries: KindEntry[] = NODE_SEQUENCE.map((kind, seq) => ({ kind, seq }));

  for (let e = 0; e < entries.length; e++) {
    const pos = walk(cx, cy, 0, rnd(4, 7), path);
    cx = pos.x;
    cy = pos.y;
    const abs = path.length - 1;
    const { kind, seq } = entries[e]!;

    if (kind === "turn") {
      const node = makeNode(kind, seq, abs);
      carveChamber(cx, cy);
      carve(cx - 1, cy);
      carve(cx + 1, cy);
      node.left = buildTail(cx - 1, cy, 3, entries.slice(e + 1), abs + 1);
      node.right = buildTail(cx + 1, cy, 1, entries.slice(e + 1), abs + 1);
      nodes.push(node);
      break; // the trunk ends at the junction; branches hold the rest
    }

    nodes.push(makeNode(kind, seq, abs));
    carveChamber(cx, cy);
  }

  return { grid, size, path, nodes };
}

export function isWall(d: Dungeon, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= d.size || y >= d.size) return true;
  return d.grid[y * d.size + x] === 1;
}
