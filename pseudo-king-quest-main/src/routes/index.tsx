import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import goblinSprite from "../assets/goblin.png";
import skeletonSprite from "../assets/skeleton.png";
import orcSprite from "../assets/orc.png";

import {
  ENEMIES,
  computeStats,
  randomEquipment,
  type Equipment,
  type Loadout,
  type Slot,
} from "../game/content";
import { generateDungeon, type Dungeon, type DungeonNode } from "../game/dungeon";
import { tickCombat, type Combatant } from "../game/combat";
import { renderScene, type Camera, type SpriteDraw } from "../game/raycaster";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Crownfall — 1인칭 레이캐스팅 던전 러너" },
      {
        name: "description",
        content:
          "자동으로 전진하는 1인칭 pseudo-3D 던전 러너. 갈림길에서 선택하고 장비를 모아 자동 전투로 오크 군주를 쓰러뜨리세요.",
      },
      { property: "og:title", content: "Crownfall — 1인칭 레이캐스팅 던전 러너" },
      {
        property: "og:description",
        content: "선택하고, 장비를 모으고, 자동 전투로 던전 끝의 왕관을 차지하세요.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GamePage,
});

const SPRITE_SRC: Record<string, string> = {
  goblin: goblinSprite,
  skeleton: skeletonSprite,
  orc: orcSprite,
};

type Phase = "walk" | "choice" | "combat" | "dead" | "clear";

interface Choice {
  label: string;
  detail: string;
  cost?: number;
  apply: () => void;
}

interface Popup {
  id: number;
  text: string;
  crit: boolean;
  side: "player" | "enemy";
  born: number;
}

interface RunState {
  dungeon: Dungeon;
  progress: number; // float index along path
  nodeIndex: number;
  target: number;
  phase: Phase;
  camAngle: number;
  bobT: number;
  enemyCell: { x: number; y: number } | null;
  swayT: number;
  enemyFlash: number;
  enemyShake: number;
  hitFlash: number;
  camX: number;
  camY: number;
  player: Combatant | null;
  enemy: Combatant | null;
}

const SLOT_LABEL: Record<Slot, string> = { weapon: "무기", armor: "방어구", charm: "부적" };

function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runRef = useRef<RunState | null>(null);
  const imagesRef = useRef<Record<string, HTMLImageElement>>({});
  const popupId = useRef(0);

  const [phase, setPhase] = useState<Phase>("walk");
  const [hp, setHp] = useState(60);
  const [maxHp, setMaxHp] = useState(60);
  const [enemyHp, setEnemyHp] = useState(0);
  const [enemyMaxHp, setEnemyMaxHp] = useState(0);
  const [enemyName, setEnemyName] = useState("");
  const [gold, setGold] = useState(40);
  const [level, setLevel] = useState(1);
  const [depth, setDepth] = useState(0);
  const [loadout, setLoadout] = useState<Loadout>({});
  const [choices, setChoices] = useState<Choice[]>([]);
  const [prompt, setPrompt] = useState("");
  const [log, setLog] = useState<string[]>(["던전의 문이 닫혔다. 앞으로 나아간다."]);
  const [popups, setPopups] = useState<Popup[]>([]);
  const [runKey, setRunKey] = useState(0);

  // mutable mirrors used inside the RAF loop
  const stateRef = useRef({ hp: 60, gold: 40, level: 1, loadout: {} as Loadout });
  stateRef.current = { hp, gold, level, loadout };

  const pushLog = useCallback((line: string) => {
    setLog((l) => [line, ...l].slice(0, 4));
  }, []);

  const addPopup = useCallback((text: string, crit: boolean, side: "player" | "enemy") => {
    const id = popupId.current++;
    setPopups((p) => [...p.slice(-8), { id, text, crit, side, born: performance.now() }]);
    setTimeout(() => setPopups((p) => p.filter((x) => x.id !== id)), 900);
  }, []);

  // preload sprites
  useEffect(() => {
    const entries = { ...SPRITE_SRC };
    for (const [key, src] of Object.entries(entries)) {
      const img = new Image();
      img.src = src;
      imagesRef.current[key] = img;
    }
  }, []);

  const startRun = useCallback(() => {
    const dungeon = generateDungeon();
    runRef.current = {
      dungeon,
      progress: 0,
      nodeIndex: 0,
      target: stopIndexFor(dungeon.nodes[0]!),
      phase: "walk",
      camAngle: angleForSegment(dungeon, 0),
      bobT: 0,
      enemyCell: null,
      swayT: 0,
      enemyFlash: 0,
      enemyShake: 0,
      hitFlash: 0,
      camX: dungeon.path[0]!.x + 0.5,
      camY: dungeon.path[0]!.y + 0.5,
      player: null,
      enemy: null,
    };
    const stats = computeStats({}, 1);
    setPhase("walk");
    setHp(stats.maxHp);
    setMaxHp(stats.maxHp);
    setGold(40);
    setLevel(1);
    setDepth(0);
    setLoadout({});
    setChoices([]);
    setPrompt("");
    setEnemyHp(0);
    setLog(["던전의 문이 닫혔다. 앞으로 나아간다."]);
  }, []);

  useEffect(() => {
    startRun();
  }, [startRun, runKey]);

  const equip = useCallback(
    (item: Equipment) => {
      setLoadout((prev) => ({ ...prev, [item.slot]: item }));
      setHp((cur) => {
        const before = computeStats(stateRef.current.loadout, stateRef.current.level).maxHp;
        const after = computeStats(
          { ...stateRef.current.loadout, [item.slot]: item },
          stateRef.current.level,
        ).maxHp;
        setMaxHp(after);
        return Math.min(after, cur + Math.max(0, after - before));
      });
      pushLog(`${item.name} 장착!`);
    },
    [pushLog],
  );

  const resume = useCallback(() => {
    const run = runRef.current;
    if (!run) return;
    setChoices([]);
    setPrompt("");
    const next = run.nodeIndex + 1;
    if (next >= run.dungeon.nodes.length) {
      run.phase = "clear";
      setPhase("clear");
      return;
    }
    run.nodeIndex = next;
    run.target = stopIndexFor(run.dungeon.nodes[next]!);
    run.phase = "walk";
    setPhase("walk");
    setDepth(next);
  }, []);

  const chooseTurn = useCallback(
    (node: DungeonNode, side: "left" | "right") => {
      const run = runRef.current;
      if (!run) return;
      const tail = side === "left" ? node.left : node.right;
      if (!tail) {
        resume();
        return;
      }
      const d = run.dungeon;
      // splice the chosen branch onto the path; the other branch stays
      // carved in the grid as a visible side passage
      d.path = [...d.path.slice(0, node.pathIndex + 1), ...tail.path];
      d.nodes = [...d.nodes.slice(0, run.nodeIndex + 1), ...tail.nodes];
      pushLog(side === "left" ? "왼쪽 길로 들어섰다." : "오른쪽 길로 들어섰다.");
      resume();
    },
    [pushLog, resume],
  );

  const beginCombat = useCallback(
    (node: DungeonNode) => {
      const run = runRef.current;
      if (!run) return;
      const def = ENEMIES[node.enemy ?? "goblin"];
      const pStats = computeStats(stateRef.current.loadout, stateRef.current.level);
      run.player = { name: "당신", hp: stateRef.current.hp, stats: pStats, cooldown: 0.5 };
      run.enemy = { name: def.name, hp: def.stats.maxHp, stats: def.stats, cooldown: 0.9 };
      run.enemyCell = run.dungeon.path[node.pathIndex]!;
      run.phase = "combat";
      setEnemyName(def.name);
      setEnemyMaxHp(def.stats.maxHp);
      setEnemyHp(def.stats.maxHp);
      setPhase("combat");
      pushLog(`${def.name}이(가) 길을 막아섰다!`);
    },
    [pushLog],
  );

  const handleNode = useCallback(
    (node: DungeonNode) => {
      const run = runRef.current!;
      if (node.kind === "combat" || node.kind === "boss") {
        beginCombat(node);
        return;
      }
      run.phase = "choice";
      setPhase("choice");

      if (node.kind === "turn") {
        setPrompt("복도가 좌우로 갈라진다. 어느 쪽으로 갈까?");
        setChoices([
          {
            label: "왼쪽 길",
            detail: turnHint(node.left),
            apply: () => chooseTurn(node, "left"),
          },
          {
            label: "오른쪽 길",
            detail: turnHint(node.right),
            apply: () => chooseTurn(node, "right"),
          },
        ]);
        return;
      }

      if (node.kind === "fork") {
        const left = randomEquipment(depth < 4 ? 1 : 2);
        setPrompt("통로 양옆에 벽감이 파여 있다. 무엇을 챙길까?");
        setChoices([
          {
            label: "왼쪽 벽감 · 녹슨 무기걸이",
            detail: `먼지 쌓인 무기고 냄새가 난다 — ${left.name} 발견`,
            apply: () => {
              equip(left);
              resume();
            },
          },
          {
            label: "오른쪽 벽감 · 흩어진 동전",
            detail: "금화 소리가 울린다 — 골드 +35",
            apply: () => {
              setGold((g) => g + 35);
              pushLog("금화 35닢을 주웠다.");
              resume();
            },
          },
        ]);
        return;
      }

      if (node.kind === "treasure") {
        const item = randomEquipment(node.tier ?? 1);
        setPrompt("낡은 보물상자가 놓여 있다.");
        setChoices([
          {
            label: "상자를 연다",
            detail: `${item.name} · 함정일 수도 있다 (30%)`,
            apply: () => {
              if (Math.random() < 0.3) {
                const dmg = 8 + Math.floor(Math.random() * 10);
                setHp((h) => Math.max(1, h - dmg));
                addPopup(`-${dmg}`, false, "player");
                pushLog(`함정! ${dmg} 피해를 입었다.`);
              } else {
                equip(item);
              }
              resume();
            },
          },
          {
            label: "지나친다",
            detail: "안전하게 통과 · 골드 +10",
            apply: () => {
              setGold((g) => g + 10);
              resume();
            },
          },
        ]);
        return;
      }

      // merchant
      const offer = randomEquipment(2);
      setPrompt("후드를 쓴 상인이 등불을 들고 서 있다.");
      setChoices([
        {
          label: `${offer.name} 구매`,
          detail: `${SLOT_LABEL[offer.slot]} · 공격 +${offer.atk} 방어 +${offer.def} 체력 +${offer.hp}`,
          cost: offer.price,
          apply: () => {
            if (stateRef.current.gold < offer.price) return;
            setGold((g) => g - offer.price);
            equip(offer);
            resume();
          },
        },
        {
          label: "치료 물약",
          detail: "체력을 40 회복한다",
          cost: 30,
          apply: () => {
            if (stateRef.current.gold < 30) return;
            setGold((g) => g - 30);
            setHp((h) => Math.min(maxHp, h + 40));
            pushLog("물약을 마셨다. 체력 +40");
            resume();
          },
        },
        {
          label: "그냥 지나간다",
          detail: "상인은 어깨를 으쓱한다",
          apply: resume,
        },
      ]);
    },
    [addPopup, beginCombat, chooseTurn, depth, equip, maxHp, pushLog, resume],
  );

  // main loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    let disposed = false;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const scale = 0.55; // chunky retro pixels
      canvas.width = Math.max(160, Math.floor(rect.width * scale));
      canvas.height = Math.max(120, Math.floor(rect.height * scale));
    };
    resize();
    window.addEventListener("resize", resize);

    const frame = (now: number) => {
      if (disposed) return;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      const run = runRef.current;
      if (run) {
        update(run, dt);
        draw(ctx, canvas.width, canvas.height, run, now / 1000);
      }
      raf = requestAnimationFrame(frame);
    };

    const update = (run: RunState, dt: number) => {
      if (run.phase === "walk") {
        const speed = 2.4;
        run.progress = Math.min(run.target, run.progress + speed * dt);
        run.bobT += dt * 9;
        if (run.progress >= run.target - 0.001) {
          run.progress = run.target;
          handleNode(run.dungeon.nodes[run.nodeIndex]!);
        }
      } else if (run.phase === "combat" && run.player && run.enemy) {
        const hits = tickCombat(run.player, run.enemy, dt);
        for (const hit of hits) {
          if (hit.attacker === "player") {
            run.enemyFlash = 1;
            run.enemyShake = hit.crit ? 10 : 5;
            setEnemyHp(run.enemy.hp);
            addPopup(`${hit.damage}${hit.crit ? "!" : ""}`, hit.crit, "enemy");
          } else {
            run.hitFlash = 1;
            setHp(run.player.hp);
            addPopup(`-${hit.damage}`, hit.crit, "player");
          }
        }
        if (run.enemy.hp <= 0) {
          const node = run.dungeon.nodes[run.nodeIndex]!;
          const def = ENEMIES[node.enemy ?? "goblin"];
          run.phase = "walk";
          run.enemyCell = null;
          setGold((g) => g + def.gold);
          setLevel((l) => {
            const nl = l + 1;
            const stats = computeStats(stateRef.current.loadout, nl);
            setMaxHp(stats.maxHp);
            setHp((h) => Math.min(stats.maxHp, h + 20));
            return nl;
          });
          pushLog(`${def.name} 처치! 골드 +${def.gold}, 레벨 업`);
          if (node.kind === "boss") {
            run.phase = "clear";
            setPhase("clear");
          } else {
            resume();
          }
        } else if (run.player.hp <= 0) {
          run.phase = "dead";
          setPhase("dead");
          setHp(0);
        }
      }

      run.enemyFlash = Math.max(0, run.enemyFlash - dt * 4);
      run.enemyShake *= 0.85;
      run.hitFlash = Math.max(0, run.hitFlash - dt * 2.5);

      // camera follow
      const { dungeon } = run;
      const i = Math.max(0, Math.floor(run.progress));
      const f = Math.max(0, run.progress - i);
      const a = dungeon.path[Math.min(i, dungeon.path.length - 1)]!;
      const b = dungeon.path[Math.min(i + 1, dungeon.path.length - 1)]!;
      run.camX = a.x + 0.5 + (b.x - a.x) * f;
      run.camY = a.y + 0.5 + (b.y - a.y) * f;

      run.swayT += dt;
      let targetAngle = angleForSegment(dungeon, Math.min(i, dungeon.path.length - 2));
      // at a crossroads, look around so both side corridors come into view
      const curNode = dungeon.nodes[run.nodeIndex];
      if (run.phase === "choice" && curNode?.kind === "turn") {
        targetAngle += Math.sin(run.swayT * 0.85) * 0.6;
      }
      let diff = targetAngle - run.camAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      run.camAngle += diff * Math.min(1, dt * 5);
    };

    const draw = (c: CanvasRenderingContext2D, w: number, h: number, run: RunState, time: number) => {
      const dirX = Math.cos(run.camAngle);
      const dirY = Math.sin(run.camAngle);
      const fov = 0.85;
      const cam: Camera = {
        x: run.camX ?? 0,
        y: run.camY ?? 0,
        dirX,
        dirY,
        planeX: -dirY * fov,
        planeY: dirX * fov,
        bob: run.phase === "walk" ? Math.sin(run.bobT) * h * 0.012 : 0,
      };

      let sprite: SpriteDraw | null = null;
      const node = run.dungeon.nodes[run.nodeIndex];
      if (run.enemyCell && node?.enemy) {
        const img = imagesRef.current[node.enemy];
        if (img) {
          sprite = {
            image: img,
            x: run.enemyCell.x + 0.5,
            y: run.enemyCell.y + 0.5,
            flash: run.enemyFlash,
            shake: (Math.random() - 0.5) * run.enemyShake,
          };
        }
      }

      renderScene(c, w, h, run.dungeon, cam, sprite, time);

      if (run.hitFlash > 0) {
        c.fillStyle = `rgba(170,20,20,${run.hitFlash * 0.35})`;
        c.fillRect(0, 0, w, h);
      }
    };

    raf = requestAnimationFrame(frame);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [addPopup, handleNode, pushLog, resume]);

  const stats = computeStats(loadout, level);
  const hpPct = Math.max(0, Math.min(100, (hp / maxHp) * 100));

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col bg-[#0b0908] text-[#e8d9b5]">
      <h1 className="sr-only">Crownfall — 1인칭 레이캐스팅 던전 러너</h1>

      {/* HUD */}
      <header className="flex items-center gap-3 border-b border-[#3a2a18] bg-[#140f0b] px-3 py-2 text-[10px] uppercase tracking-widest">
        <div className="flex-1">
          <div className="h-2 w-full overflow-hidden rounded-sm bg-[#2a1a14]">
            <div
              className="h-full bg-gradient-to-r from-[#c2452d] to-[#f0a24a] transition-[width] duration-200"
              style={{ width: `${hpPct}%` }}
            />
          </div>
          <span className="mt-1 block text-[#c9a86b]">
            HP {Math.max(0, Math.round(hp))}/{Math.round(maxHp)}
          </span>
        </div>
        <span className="text-[#f0a24a]">Lv.{level}</span>
        <span className="text-[#e8c56b]">{gold} G</span>
        <span className="text-[#8a7351]">{depth + 1}/10</span>
      </header>

      {/* Viewport */}
      <div className="relative aspect-[3/4] w-full overflow-hidden border-b border-[#3a2a18] bg-black">
        <canvas
          ref={canvasRef}
          className="h-full w-full"
          style={{ imageRendering: "pixelated" }}
          aria-label="던전 1인칭 시점"
        />

        {phase === "combat" && (
          <div className="absolute inset-x-4 top-3">
            <div className="mb-1 flex justify-between text-[10px] uppercase tracking-widest text-[#e8c56b]">
              <span>{enemyName}</span>
              <span>
                {enemyHp}/{enemyMaxHp}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-sm bg-[#2a1a14]">
              <div
                className="h-full bg-[#8fbf5a] transition-[width] duration-150"
                style={{ width: `${(enemyHp / Math.max(1, enemyMaxHp)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {popups.map((p, idx) => (
          <span
            key={p.id}
            className={`pointer-events-none absolute animate-[floatUp_0.9s_ease-out_forwards] font-bold ${
              p.side === "enemy"
                ? p.crit
                  ? "text-[#ffd34d] text-2xl"
                  : "text-[#fff1cf] text-lg"
                : "text-[#ff6b5a] text-lg"
            }`}
            style={{
              left: `${p.side === "enemy" ? 42 + ((idx * 7) % 16) : 20 + ((idx * 5) % 10)}%`,
              top: `${p.side === "enemy" ? 38 : 62}%`,
            }}
          >
            {p.text}
          </span>
        ))}

      </div>

      {/* Event / choices */}
      <section className="flex-1 space-y-2 px-3 py-3">
        {phase === "walk" && (
          <p className="py-4 text-center text-xs tracking-widest text-[#8a7351]">
            어둠 속으로 전진하는 중…
          </p>
        )}

        {phase === "combat" && (
          <p className="py-4 text-center text-xs tracking-widest text-[#c2452d]">
            전투 중 · 장비가 승패를 가른다
          </p>
        )}

        {phase === "choice" && (
          <>
            <p className="text-sm text-[#e8d9b5]">{prompt}</p>
            {choices.map((c) => {
              const locked = c.cost !== undefined && gold < c.cost;
              return (
                <button
                  key={c.label}
                  onClick={c.apply}
                  disabled={locked}
                  className="w-full rounded-sm border border-[#4a3520] bg-[#191209] px-3 py-2 text-left transition-colors hover:border-[#f0a24a] hover:bg-[#221708] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="block text-sm text-[#f0d9a0]">
                    {c.label}
                    {c.cost !== undefined ? ` · ${c.cost}G` : ""}
                  </span>
                  <span className="block text-[11px] text-[#8a7351]">{c.detail}</span>
                </button>
              );
            })}
          </>
        )}

        {(phase === "dead" || phase === "clear") && (
          <div className="space-y-3 py-4 text-center">
            <p className="text-lg tracking-widest text-[#f0a24a]">
              {phase === "clear" ? "왕관은 당신의 것이다" : "당신은 던전에서 스러졌다"}
            </p>
            <p className="text-xs text-[#8a7351]">
              Lv.{level} · {gold} G · {depth + 1}번째 방
            </p>
            <button
              onClick={() => setRunKey((k) => k + 1)}
              className="rounded-sm border border-[#f0a24a] px-6 py-2 text-sm tracking-widest text-[#f0a24a] transition-colors hover:bg-[#f0a24a] hover:text-[#140f0b]"
            >
              다시 도전
            </button>
          </div>
        )}

        {/* log */}
        <ul className="space-y-0.5 pt-2 text-[11px] text-[#6d5a3e]">
          {log.map((line, i) => (
            <li key={`${line}-${i}`} style={{ opacity: 1 - i * 0.22 }}>
              › {line}
            </li>
          ))}
        </ul>
      </section>

      {/* Equipment */}
      <footer className="grid grid-cols-3 gap-2 border-t border-[#3a2a18] bg-[#140f0b] px-3 py-2">
        {(["weapon", "armor", "charm"] as Slot[]).map((slot) => {
          const item = loadout[slot];
          return (
            <div key={slot} className="rounded-sm border border-[#3a2a18] px-2 py-1">
              <span className="block text-[9px] uppercase tracking-widest text-[#6d5a3e]">
                {SLOT_LABEL[slot]}
              </span>
              <span className="block truncate text-[11px] text-[#e8d9b5]">
                {item ? item.name : "비어 있음"}
              </span>
            </div>
          );
        })}
        <p className="col-span-3 text-[10px] tracking-widest text-[#6d5a3e]">
          공격 {Math.round(stats.atk)} · 방어 {Math.round(stats.def)} · 속도{" "}
          {stats.speed.toFixed(2)} · 치명 {Math.round(stats.crit * 100)}%
        </p>
      </footer>
    </main>
  );
}

function angleForSegment(d: Dungeon, i: number) {
  const a = d.path[Math.max(0, Math.min(i, d.path.length - 2))]!;
  const b = d.path[Math.max(1, Math.min(i + 1, d.path.length - 1))]!;
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/** flavor hint for a branch, based on what waits at its first stop */
function turnHint(tail: DungeonNode["left"]): string {
  switch (tail?.nodes[0]?.kind) {
    case "combat":
      return "낮은 으르렁거리는 소리가 들린다";
    case "treasure":
      return "희미한 금빛이 새어 나온다";
    case "merchant":
      return "따뜻한 등불 불빛이 흔들린다";
    case "fork":
      return "먼지 쌓인 벽감이 어른거린다";
    case "turn":
      return "어둠 속으로 더 깊이 이어진다";
    case "boss":
      return "무거운 발소리가 울려 퍼진다";
    default:
      return "알 수 없는 어둠이 고여 있다";
  }
}

function stopIndexFor(node: DungeonNode) {
  return node.kind === "combat" || node.kind === "boss"
    ? Math.max(0, node.pathIndex - 2)
    : node.pathIndex;
}

export default GamePage;
