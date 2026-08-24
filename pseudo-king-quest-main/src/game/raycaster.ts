import { isWall, type Dungeon } from "./dungeon";

export interface Camera {
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  planeX: number;
  planeY: number;
  bob: number;
}

export interface SpriteDraw {
  image: HTMLImageElement;
  x: number;
  y: number;
  /** 0..1 white flash for hit feedback */
  flash: number;
  shake: number;
}

/** deterministic 0..1 hash for per-cell texture variation */
function hash2(x: number, y: number, s: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function shade(base: [number, number, number], amount: number) {
  const k = Math.max(0.08, Math.min(1, amount));
  return `rgb(${Math.round(base[0] * k)},${Math.round(base[1] * k)},${Math.round(base[2] * k)})`;
}

/** flagstone floor + rock ceiling, per-pixel with torch light pool */
function drawFloorCeiling(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cam: Camera,
  horizonPx: number,
  flick: number,
) {
  const img = ctx.createImageData(w, h);
  const data = img.data;

  const rayLeftX = cam.dirX - cam.planeX;
  const rayLeftY = cam.dirY - cam.planeY;
  const rayRightX = cam.dirX + cam.planeX;
  const rayRightY = cam.dirY + cam.planeY;

  for (let y = 0; y < h; y++) {
    const isFloor = y > horizonPx;
    const p = Math.max(1, isFloor ? y - horizonPx : horizonPx - y);
    const rowDist = (0.5 * h) / p;

    const stepX = (rowDist * (rayRightX - rayLeftX)) / w;
    const stepY = (rowDist * (rayRightY - rayLeftY)) / w;
    let fx = cam.x + rowDist * rayLeftX;
    let fy = cam.y + rowDist * rayLeftY;

    // warm pool of torchlight that dies out with distance
    const light = Math.min(1, 2.4 / (1 + rowDist * rowDist * 0.38)) * flick;

    for (let x = 0; x < w; x++) {
      const cx = Math.floor(fx);
      const cy = Math.floor(fy);
      const tx = fx - cx;
      const ty = fy - cy;
      const j = hash2(cx, cy, isFloor ? 3 : 7);

      let r: number;
      let g: number;
      let b: number;
      if (isFloor) {
        // flagstones: per-tile tone, checker, dark mortar seams
        const tone = 0.72 + j * 0.5;
        r = 98 * tone;
        g = 84 * tone;
        b = 68 * tone;
        if (((cx + cy) & 1) === 0) {
          r *= 0.86;
          g *= 0.86;
          b *= 0.86;
        }
        if (tx < 0.07 || ty < 0.07) {
          r *= 0.42;
          g *= 0.42;
          b *= 0.42;
        }
      } else {
        // ceiling rock: cold, dark, speckled
        const tone = 0.55 + j * 0.9;
        r = 36 * tone;
        g = 31 * tone;
        b = 40 * tone;
        if (j > 0.93) {
          r *= 1.6;
          g *= 1.5;
          b *= 1.3;
        }
      }

      const li = isFloor ? light : Math.min(1, light * 0.55 + 0.04);
      const idx = (y * w + x) * 4;
      data[idx] = r * li;
      data[idx + 1] = g * li;
      data[idx + 2] = b * li;
      data[idx + 3] = 255;

      fx += stepX;
      fy += stepY;
    }
  }
  ctx.putImageData(img, 0, 0);
}

const WALL_ROWS = 4; // brick courses per wall height

export function renderScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  dungeon: Dungeon,
  cam: Camera,
  sprite: SpriteDraw | null,
  time = 0,
) {
  const horizon = h / 2 + cam.bob;
  const horizonPx = Math.max(1, Math.min(h - 1, Math.round(horizon)));

  // torch flicker shared by every light term this frame
  const flick = 1 + 0.07 * Math.sin(time * 9.3) + 0.05 * Math.sin(time * 23.7 + 1.3);

  drawFloorCeiling(ctx, w, h, cam, horizonPx, flick);

  const zBuffer = new Float32Array(w);

  for (let x = 0; x < w; x++) {
    const cameraX = (2 * x) / w - 1;
    const rayDirX = cam.dirX + cam.planeX * cameraX;
    const rayDirY = cam.dirY + cam.planeY * cameraX;

    let mapX = Math.floor(cam.x);
    let mapY = Math.floor(cam.y);

    const deltaX = Math.abs(1 / (rayDirX || 1e-6));
    const deltaY = Math.abs(1 / (rayDirY || 1e-6));

    let stepX: number;
    let stepY: number;
    let sideDistX: number;
    let sideDistY: number;

    if (rayDirX < 0) {
      stepX = -1;
      sideDistX = (cam.x - mapX) * deltaX;
    } else {
      stepX = 1;
      sideDistX = (mapX + 1 - cam.x) * deltaX;
    }
    if (rayDirY < 0) {
      stepY = -1;
      sideDistY = (cam.y - mapY) * deltaY;
    } else {
      stepY = 1;
      sideDistY = (mapY + 1 - cam.y) * deltaY;
    }

    let side = 0;
    let hit = false;
    let guard = 0;
    while (!hit && guard++ < 128) {
      if (sideDistX < sideDistY) {
        sideDistX += deltaX;
        mapX += stepX;
        side = 0;
      } else {
        sideDistY += deltaY;
        mapY += stepY;
        side = 1;
      }
      if (isWall(dungeon, mapX, mapY)) hit = true;
    }

    const perpDist =
      side === 0 ? (mapX - cam.x + (1 - stepX) / 2) / (rayDirX || 1e-6) : (mapY - cam.y + (1 - stepY) / 2) / (rayDirY || 1e-6);
    const dist = Math.max(0.05, perpDist);
    zBuffer[x] = dist;

    const lineHeight = h / dist;
    const drawStart = Math.max(0, -lineHeight / 2 + horizon);
    const drawEnd = Math.min(h, lineHeight / 2 + horizon);
    if (drawEnd <= drawStart) continue;

    // where along the wall cell the ray landed (0..1) — drives the brick pattern
    let wallX = side === 0 ? cam.y + perpDist * rayDirY : cam.x + perpDist * rayDirX;
    wallX -= Math.floor(wallX);

    const light = (1.5 / (1 + dist * 0.55)) * flick;
    const fog = 1 / (1 + dist * dist * 0.05);
    const base: [number, number, number] = side === 1 ? [104, 84, 66] : [148, 122, 94];
    const cellJitter = 0.88 + hash2(mapX, mapY, 11) * 0.24;
    const mossy = hash2(mapX, mapY, 53) > 0.6;

    const segH = (drawEnd - drawStart) / WALL_ROWS;
    for (let row = 0; row < WALL_ROWS; row++) {
      const y0 = drawStart + segH * row;
      const y1 = row === WALL_ROWS - 1 ? drawEnd : drawStart + segH * (row + 1);

      // running-bond bricks: 2 per cell, alternate courses offset by half a brick
      const bu = wallX * 2 + (row % 2 === 0 ? 0 : 0.5);
      const brickIdx = Math.floor(bu);
      const bf = bu - brickIdx;
      const joint = bf < 0.09;
      const bj = 0.8 + hash2(mapX * 3 + brickIdx, mapY * 5 + row, 29) * 0.4;

      let tint = base;
      let k = light * fog * cellJitter * bj;
      // damp moss creeping up the lowest course
      if (row === WALL_ROWS - 1 && mossy) {
        tint = [base[0] * 0.62, base[1] * 0.82, base[2] * 0.55];
        k *= 0.85;
      }
      if (joint) k *= 0.42;

      ctx.fillStyle = shade(tint, k);
      ctx.fillRect(x, y0, 1, y1 - y0);

      // horizontal mortar between courses
      if (row > 0) {
        ctx.fillStyle = shade(base, light * fog * 0.3);
        ctx.fillRect(x, y0 - 0.5, 1, 1);
      }
    }

    // ambient occlusion where wall meets ceiling and floor
    const ao = Math.min(0.5, 0.3 * fog + 0.12);
    ctx.fillStyle = `rgba(0,0,0,${ao.toFixed(3)})`;
    ctx.fillRect(x, drawStart, 1, Math.max(1, segH * 0.14));
    ctx.fillRect(x, drawEnd - Math.max(1, segH * 0.2), 1, Math.max(1, segH * 0.2));
  }

  if (sprite) drawSprite(ctx, w, h, cam, sprite, zBuffer, horizon);

  // torch vignette, breathing slightly with the flame
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.15, w / 2, h / 2, h * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, `rgba(0,0,0,${(0.74 - (flick - 1) * 0.6).toFixed(3)})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cam: Camera,
  sprite: SpriteDraw,
  zBuffer: Float32Array,
  horizon: number,
) {
  if (!sprite.image.complete || sprite.image.naturalWidth === 0) return;

  const spriteX = sprite.x - cam.x;
  const spriteY = sprite.y - cam.y;

  const invDet = 1 / (cam.planeX * cam.dirY - cam.dirX * cam.planeY);
  const transformX = invDet * (cam.dirY * spriteX - cam.dirX * spriteY);
  const transformY = invDet * (-cam.planeY * spriteX + cam.planeX * spriteY);
  if (transformY <= 0.15) return;

  const screenX = Math.round((w / 2) * (1 + transformX / transformY)) + sprite.shake;
  const spriteH = Math.abs(Math.round(h / transformY)) * 0.85;
  const spriteW = spriteH;
  const drawStartY = horizon + Math.abs(h / transformY) / 2 - spriteH;
  const drawStartX = screenX - spriteW / 2;

  // occlusion: skip if the center column is behind a wall
  const centerCol = Math.max(0, Math.min(w - 1, screenX));
  if (zBuffer[centerCol]! < transformY) return;

  const light = Math.max(0.25, Math.min(1, 1.4 / (1 + transformY * 0.45)));

  ctx.save();
  const flash = Math.max(0, Math.min(1, sprite.flash));
  ctx.filter = `brightness(${(light + flash * 0.9).toFixed(2)}) saturate(${(1 + flash).toFixed(2)}) sepia(${(0.25 + flash * 0.4).toFixed(2)})`;
  ctx.drawImage(sprite.image, drawStartX, drawStartY, spriteW, spriteH);
  ctx.restore();
}
