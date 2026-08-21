const W = 540;
const H = 960;

new Phaser.Game({
  type: Phaser.CANVAS,
  parent: "game",
  width: W,
  height: H,
  backgroundColor: "#050606",
  pixelArt: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: { preload, create, update },
});

function preload() {
  this.load.image("floor", "godot/assets/generated/floor_road.png");
  this.load.image("wall", "godot/assets/generated/wall_side.png");
  this.load.image("cavePropsRaw", "godot/assets/generated/cave_props.png");
  this.load.image("rubblePropsRaw", "godot/assets/generated/rubble_props.png");
  this.load.image("warrior", "godot/assets/generated/warrior2.png");
  this.load.image("archer", "godot/assets/generated/archer2.png");
}

function create() {
  this.state = {
    phase: "walk",
    bossHp: 320,
    bossMaxHp: 320,
    attack: 22,
    armor: 0,
    gold: 0,
    encounter: 0,
    timer: 0,
    road: 0,
    hitTimer: 0,
    rewardTimer: 0,
    enemyZ: 1,
  };
  this.parties = [
    { name: "정찰 전사", kind: "warrior", hp: 65, atk: 7, reward: "공격 +5" },
    { name: "궁수 2인조", kind: "archer", hp: 90, atk: 10, reward: "흡혈 +20" },
    { name: "토벌 파티", kind: "warrior", hp: 125, atk: 14, reward: "방어 +3" },
    { name: "원정 궁수대", kind: "archer", hp: 150, atk: 17, reward: "최대 HP +60" },
    { name: "영웅 선발대", kind: "warrior", hp: 210, atk: 23, reward: "자원 +100" },
  ];
  keyGreen(this, "cavePropsRaw", "caveProps");
  keyGreen(this, "rubblePropsRaw", "rubbleProps");
  this.propFrames = [
    { key: "caveProps", x: 80, y: 690, w: 95, h: 145 },
    { key: "caveProps", x: 710, y: 660, w: 150, h: 175 },
    { key: "caveProps", x: 1035, y: 725, w: 160, h: 125 },
    { key: "rubbleProps", x: 40, y: 92, w: 180, h: 100 },
    { key: "rubbleProps", x: 235, y: 62, w: 230, h: 130 },
    { key: "rubbleProps", x: 500, y: 285, w: 250, h: 135 },
    { key: "rubbleProps", x: 705, y: 515, w: 330, h: 175 },
  ];
  this.props = Array.from({ length: 7 }, (_, i) => resetProp(this, { sprite: this.add.image(-999, -999, "caveProps").setVisible(false).setDepth(2) }, i / 7));

  this.wallCanvas = this.textures.createCanvas("wallRender", W, H);
  this.wall = this.add.image(0, 0, "wallRender").setOrigin(0).setDepth(0);
  this.floorCanvas = this.textures.createCanvas("floorRender", W, H);
  this.floor = this.add.image(0, 0, "floorRender").setOrigin(0).setDepth(1);
  this.corridor = this.add.graphics().setDepth(1);
  this.enemy = this.add.image(W / 2, 300, "warrior").setScale(0.05).setDepth(4).setVisible(false);
  this.flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0).setDepth(20);
  this.title = text(this, W / 2, 28, "보스의 던전 나들이", 24).setOrigin(0.5);
  this.hp = text(this, 18, 66, "", 15).setOrigin(0, 0);
  this.floorText = text(this, W - 18, 66, "", 15).setOrigin(1, 0);
  this.log = text(this, W / 2, H - 42, "던전 복도를 자동 순찰한다.", 17).setOrigin(0.5);
  this.rewardText = text(this, W / 2, 360, "", 28).setOrigin(0.5).setVisible(false);
  this.hpBarBg = this.add.rectangle(18, 94, 210, 12, 0x1a1a18).setOrigin(0, 0).setDepth(9);
  this.hpBar = this.add.rectangle(18, 94, 210, 12, 0xb43a35).setOrigin(0, 0).setDepth(10);

  this.input.keyboard.on("keydown", (e) => {
    if (this.state.phase === "end" && e.code === "Space") this.scene.restart();
  });
}

function update(_, deltaMs) {
  const dt = deltaMs / 1000;
  const s = this.state;
  s.timer += dt;
  drawCorridor(this);
  this.flash.setAlpha(Math.max(0, this.flash.alpha - dt * 4));

  if (s.phase === "walk") {
    s.road += dt;
    this.enemy.setVisible(false);
    if (s.road > 2.15) startFight(this);
  }

  if (s.phase === "fight") fightTick(this, dt);

  if (s.phase === "reward") {
    s.rewardTimer -= dt;
    if (s.rewardTimer <= 0) nextEncounter(this);
  }

  this.hp.setText(`HP ${Math.max(0, Math.ceil(s.bossHp))}/${s.bossMaxHp}  ATK ${s.attack}  ARM ${s.armor}  자원 ${s.gold}`);
  this.floorText.setText(`조우 ${Math.min(s.encounter + 1, this.parties.length)}/${this.parties.length}`);
  this.hpBar.width = 210 * Math.max(0, s.bossHp / s.bossMaxHp);
}

function drawCorridor(scene) {
  const g = scene.corridor;
  const offset = (scene.state.timer * 180) % 82;
  drawProjectedFloor(scene);
  g.clear();
  g.fillStyle(0x070808, 0.12).fillRect(0, 0, W, H);
  drawWalls(g, offset);
  drawProps(scene);

  for (let y = 205 + offset; y < H + 90; y += 82) {
    const t = (y - 165) / (H - 165);
    const left = W / 2 - 42 - (W / 2 - 42) * t;
    const right = W / 2 + 42 + (W / 2 - 42) * t;
    g.lineStyle(Math.max(1, t * 3), 0x71766b, 0.16);
    g.lineBetween(left, y, right, y);
  }
  for (const x of [225, 270, 315]) {
    g.lineStyle(1, 0x30352f, 0.4);
    g.lineBetween(W / 2, 165, x + (x - W / 2) * 4.2, H);
  }
  g.fillStyle(0x15100d, 1).fillRoundedRect(W / 2 - 44, 92, 88, 132, 36);
  g.lineStyle(5, 0x070606, 1).strokeRoundedRect(W / 2 - 44, 92, 88, 132, 36);
}

function drawWalls(g, offset) {
  g.fillStyle(0x060807, 0.18);
  g.fillPoints([{ x: 0, y: H }, { x: W / 2 - 62, y: 165 }, { x: W * 0.34, y: H }], true);
  g.fillPoints([{ x: W, y: H }, { x: W / 2 + 62, y: 165 }, { x: W * 0.66, y: H }], true);
  g.fillStyle(0x121715, 0.22);
  g.fillPoints([{ x: 0, y: 0 }, { x: W / 2 - 62, y: 165 }, { x: 0, y: H }], true);
  g.fillPoints([{ x: W, y: 0 }, { x: W / 2 + 62, y: 165 }, { x: W, y: H }], true);

  for (let y = 190 + offset; y < H + 90; y += 96) {
    const t = (y - 165) / (H - 165);
    const lx = W / 2 - 62 - (W / 2 - 62) * t;
    const rx = W / 2 + 62 + (W / 2 - 62) * t;
    g.lineStyle(Math.max(1, t * 5), 0x3e443d, 0.24);
    g.lineBetween(0, y, lx, y);
    g.lineBetween(rx, y, W, y);
  }

}

function drawProps(scene) {
  for (const prop of scene.props) {
    prop.z -= 0.0024;
    if (prop.z <= 0.02) resetProp(scene, prop, 1);
    const p = 1 - prop.z;
    const roadWidth = Phaser.Math.Linear(58, 455, p * p);
    const side = prop.side < 0 ? -1 : 1;
    const edgePadding = prop.frame.key === "rubbleProps" ? 84 : 68;
    const x = W / 2 + side * (roadWidth / 2 + edgePadding + p * 62);
    const y = 300 + Math.pow(p, 1.28) * 580;
    const scale = (0.11 + p * 0.38) * prop.size;
    prop.sprite.setVisible(y > 300).setTexture(prop.frame.key).setCrop(prop.frame.x, prop.frame.y, prop.frame.w, prop.frame.h);
    prop.sprite.setOrigin(0.5, 1);
    prop.sprite.setPosition(x, y).setScale(scale).setAlpha(Phaser.Math.Clamp(0.18 + p * 0.72, 0.18, 0.82)).setDepth(p > 0.78 ? 3 : 2);
  }
}

function resetProp(scene, prop, z) {
  const frame = Phaser.Utils.Array.GetRandom(scene.propFrames);
  Object.assign(prop, { frame, z, side: Math.random() < 0.5 ? -1 : 1, size: Phaser.Math.FloatBetween(0.75, 1.2) });
  return prop;
}

function drawProjectedWalls(scene) {
  const tex = scene.wallCanvas;
  const ctx = tex.context;
  const src = scene.textures.get("wall").getSourceImage();
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#070908";
  ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = false;

  const horizon = 165;
  const speed = scene.state.timer * 320;
  ctx.globalAlpha = 0.72;
  ctx.drawImage(src, 0, Math.floor(speed % (src.height - 160)), src.width, 160, 0, 0, W, horizon + 28);
  for (let y = horizon; y < H; y += 4) {
    const p = (y - horizon) / (H - horizon);
    const roadWidth = Phaser.Math.Linear(58, 455, p * p);
    const leftRoad = W / 2 - roadWidth / 2;
    const rightRoad = W / 2 + roadWidth / 2;
    const sideW = Math.max(0, leftRoad);
    const sampleY = Math.floor((speed + (1 / Math.max(0.04, p)) * 260) % (src.height - 24));
    const sampleH = Math.floor(8 + p * 16);
    ctx.globalAlpha = Phaser.Math.Clamp(0.28 + p * 0.55, 0.28, 0.78);
    ctx.drawImage(src, 0, sampleY, src.width, sampleH, 0, y, sideW, 4);
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(src, 0, sampleY, src.width, sampleH, -W, y, W - rightRoad, 4);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  tex.refresh();
}

function drawProjectedFloor(scene) {
  const tex = scene.floorCanvas;
  const ctx = tex.context;
  const src = scene.textures.get("floor").getSourceImage();
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#070808";
  ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = false;

  const horizon = 165;
  const speed = scene.state.timer * 320;
  for (let y = horizon; y < H; y += 4) {
    const p = (y - horizon) / (H - horizon);
    const depth = 1 / Math.max(0.04, p);
    const roadWidth = Phaser.Math.Linear(58, 455, p * p);
    const left = W / 2 - roadWidth / 2;
    const sampleW = Math.floor(src.width * Phaser.Math.Clamp(0.56 + p * 0.4, 0.56, 0.96));
    const sampleX = Math.floor((src.width - sampleW) / 2);
    const sampleY = Math.floor((speed + depth * 260) % (src.height - 28));
    const sampleH = Math.floor(6 + p * 18);
    ctx.globalAlpha = Phaser.Math.Clamp(0.18 + p * 0.62, 0.18, 0.8);
    ctx.drawImage(src, sampleX, sampleY, sampleW, sampleH, left, y, roadWidth, 4);
  }
  ctx.globalAlpha = 1;
  tex.refresh();
}

function startFight(scene) {
  const p = scene.parties[scene.state.encounter];
  scene.state.phase = "fight";
  scene.state.road = 0;
  scene.state.enemyZ = 1;
  scene.state.hitTimer = 0;
  scene.enemy.setTexture(p.kind).setVisible(true);
  scene.log.setText(`${p.name} 조우. 보스가 자동 공격을 시작한다.`);
}

function fightTick(scene, dt) {
  const s = scene.state;
  const p = scene.parties[s.encounter];
  s.enemyZ = Math.max(0.18, s.enemyZ - dt * 0.34);
  const k = 1 - s.enemyZ;
  const breathe = 1 + Math.sin(s.timer * 5) * 0.035;
  scene.enemy.setPosition(W / 2 + Math.sin(s.timer * 2.4) * 5, 185 + k * 360 + Math.sin(s.timer * 5) * 3);
  scene.enemy.setScale((0.05 + k * 0.22) * breathe);
  s.hitTimer += dt;
  if (s.hitTimer < 0.95) return;
  s.hitTimer = 0;
  p.hp -= s.attack;
  s.bossHp -= Math.max(1, p.atk - s.armor);
  scene.flash.setAlpha(0.22);
  scene.log.setText(`${p.name} 전투 중  |  적 HP ${Math.max(0, p.hp)}  |  자동 공격 ${s.attack}`);
  if (p.hp <= 0) absorbReward(scene, p);
  if (s.bossHp <= 0) end(scene, "패배 - 용사들이 던전 코어를 탈환했다");
}

function absorbReward(scene, party) {
  scene.state.phase = "reward";
  scene.state.rewardTimer = 1.2;
  scene.enemy.setVisible(false);
  applyReward(scene.state, party.reward);
  scene.rewardText.setText(`${party.reward} 흡수`).setVisible(true);
  scene.log.setText(`${party.name} 제압. 던전의 힘을 자동 회수한다.`);
}

function applyReward(s, reward) {
  const n = Number(reward.match(/\d+/)?.[0] || 0);
  if (reward.includes("공격")) s.attack += n;
  if (reward.includes("방어")) s.armor += n;
  if (reward.includes("HP")) {
    s.bossMaxHp += n;
    s.bossHp = Math.min(s.bossMaxHp, s.bossHp + n);
  }
  if (reward.includes("흡혈")) s.bossHp = Math.min(s.bossMaxHp, s.bossHp + n);
  if (reward.includes("자원")) s.gold += n;
}

function nextEncounter(scene) {
  const s = scene.state;
  scene.rewardText.setVisible(false);
  s.encounter += 1;
  if (s.encounter >= scene.parties.length) return end(scene, "승리 - 침입자를 모두 처치하고 던전 자원을 회수했다");
  s.phase = "walk";
  scene.log.setText("다음 용사 파티를 향해 자동 전진한다.");
}

function end(scene, message) {
  scene.state.phase = "end";
  scene.enemy.setVisible(false);
  scene.rewardText.setVisible(false);
  scene.log.setText(`${message}  |  Space로 재시작`);
}

function text(scene, x, y, value, size) {
  return scene.add.text(x, y, value, {
    fontFamily: "system-ui, sans-serif",
    fontSize: `${size}px`,
    fontStyle: "800",
    color: "#f4f1e8",
    stroke: "#050606",
    strokeThickness: 5,
  }).setDepth(30);
}

function keyGreen(scene, sourceKey, targetKey) {
  const src = scene.textures.get(sourceKey).getSourceImage();
  const tex = scene.textures.createCanvas(targetKey, src.width, src.height);
  const ctx = tex.context;
  ctx.drawImage(src, 0, 0);
  const image = ctx.getImageData(0, 0, src.width, src.height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 1] > 90 && data[i + 1] > data[i] * 1.28 && data[i + 1] > data[i + 2] * 1.28) data[i + 3] = 0;
  }
  ctx.putImageData(image, 0, 0);
  tex.refresh();
}
