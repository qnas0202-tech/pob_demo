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
  this.load.audio("walk", "audio/walk.wav");
  this.load.audio("encounter", "audio/encounter.wav");
  this.load.audio("attack", "audio/attack.wav");
  this.load.audio("hit", "audio/hit.wav");
  this.load.audio("win", "audio/win.wav");
  this.load.audio("lose", "audio/lose.wav");
  this.load.audio("bgm", "audio/bgm.wav");
}

function create() {
  this.state = {
    phase: "start",
    soundOn: false,
    bossHp: 320,
    bossMaxHp: 320,
    bossHpLag: 1,
    attack: 22,
    armor: 0,
    gold: 0,
    encounter: 0,
    timer: 0,
    road: 0,
    walkScroll: 0,
    hitTimer: 0,
    rewardTimer: 0,
    defeatedTimer: 0,
    enemyZ: 1,
    enemyHurt: 0,
    bossHurt: 0,
    counterTimer: 0,
    enemyDash: 0,
    enemyFlash: 0,
    enemyHpLag: 1,
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
  this.enemyHpBg = this.add.rectangle(W / 2, 240, 76, 8, 0x1a1a18).setOrigin(0.5).setDepth(5).setVisible(false);
  this.enemyHpLagBar = this.add.rectangle(W / 2, 240, 76, 8, 0xf0b24b).setOrigin(0.5).setDepth(6).setVisible(false);
  this.enemyHpBar = this.add.rectangle(W / 2, 240, 76, 8, 0xd84a3a).setOrigin(0.5).setDepth(7).setVisible(false);
  this.flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0).setDepth(20);
  this.sfx = {
    bgm: this.sound.add("bgm", { loop: true, volume: 0.34 }),
    walk: this.sound.add("walk", { loop: true, volume: 0.24 }),
    encounter: this.sound.add("encounter", { volume: 0.65 }),
    attack: this.sound.add("attack", { volume: 0.35 }),
    hit: this.sound.add("hit", { volume: 0.75 }),
    win: this.sound.add("win", { loop: true, volume: 0.75 }),
    lose: this.sound.add("lose", { volume: 0.75 }),
  };
  this.sound.mute = true;
  this.title = text(this, W / 2, 28, "", 24).setOrigin(0.5);
  this.hp = text(this, 18, 28, "", 15).setOrigin(0, 0);
  this.floorText = text(this, W - 18, 28, "", 15).setOrigin(1, 0);
  this.log = text(this, W / 2, H - 42, "던전 복도를 자동 순찰한다.", 17).setOrigin(0.5);
  this.rewardText = text(this, W / 2, 360, "", 28).setOrigin(0.5).setVisible(false);
  this.defeatedText = text(this, W / 2, 455, "", 24).setOrigin(0.5).setVisible(false);
  this.hpBarBg = this.add.rectangle(18, 56, 210, 12, 0x1a1a18).setOrigin(0, 0).setDepth(9);
  this.hpLagBar = this.add.rectangle(18, 56, 210, 12, 0xf0b24b).setOrigin(0, 0).setDepth(10);
  this.hpBar = this.add.rectangle(18, 56, 210, 12, 0xb43a35).setOrigin(0, 0).setDepth(11);
  this.soundToggle = this.add.graphics().setDepth(31).setInteractive(new Phaser.Geom.Rectangle(W - 66, 66, 48, 42), Phaser.Geom.Rectangle.Contains);
  this.soundToggle.on("pointerdown", () => toggleSound(this));
  this.startPanel = this.add.rectangle(W / 2, H / 2, W, H, 0x050606, 0.72).setDepth(40);
  this.startText = text(this, W / 2, H / 2 - 74, "", 44).setOrigin(0.5).setDepth(41);
  this.startSound = this.add.graphics().setDepth(41).setInteractive(new Phaser.Geom.Rectangle(W / 2 - 28, H / 2 - 22, 56, 44), Phaser.Geom.Rectangle.Contains);
  this.startHit = this.add.rectangle(W / 2, H / 2 + 72, 190, 62, 0x2a211b, 0.92).setDepth(41).setInteractive({ useHandCursor: true });
  this.startHit.setStrokeStyle(3, 0xf4f1e8, 0.9);
  this.startButton = text(this, W / 2, H / 2 + 72, "START", 26).setOrigin(0.5).setDepth(42).setInteractive({ useHandCursor: true });
  this.startSound.on("pointerdown", () => toggleSound(this));
  drawSoundIcons(this);
  this.startHit.on("pointerdown", () => startGame(this));
  this.startButton.on("pointerdown", () => startGame(this));

  this.input.keyboard.on("keydown", (e) => {
    if (this.state.phase === "start" && e.code === "Space") startGame(this);
    if (this.state.phase === "end" && e.code === "Space") returnToStart(this);
  });
}

function update(_, deltaMs) {
  const dt = deltaMs / 1000;
  const s = this.state;
  s.timer += dt;
  drawCorridor(this);
  this.flash.setAlpha(Math.max(0, this.flash.alpha - dt * 4));

  if (s.phase === "walk") {
    startWalkSound(this);
    s.road += dt * 0.5;
    s.walkScroll += dt * 0.5;
    this.enemy.setVisible(false);
    this.enemyHpBg.setVisible(false);
    this.enemyHpLagBar.setVisible(false);
    this.enemyHpBar.setVisible(false);
    if (s.road > 2.15) startFight(this);
  }

  if (s.phase === "fight") fightTick(this, dt);

  if (s.phase === "defeated") {
    s.defeatedTimer -= dt;
    this.enemy.angle = -82 + Math.sin(s.timer * 10) * 2;
    this.enemy.setAlpha(0.72);
    if (s.defeatedTimer <= 0) absorbReward(this, this.parties[s.encounter]);
  }

  if (s.phase === "reward") {
    s.rewardTimer -= dt;
    if (s.rewardTimer <= 0) nextEncounter(this);
  }

  this.hp.setText(`HP ${Math.max(0, Math.ceil(s.bossHp))}/${s.bossMaxHp}  ATK ${s.attack}  ARM ${s.armor}  자원 ${s.gold}`);
  this.floorText.setText(`파티 ${Math.min(s.encounter + 1, this.parties.length)}/${this.parties.length}`);
  const bossHpRatio = Math.max(0, s.bossHp / s.bossMaxHp);
  s.bossHpLag = Math.max(bossHpRatio, Phaser.Math.Linear(s.bossHpLag, bossHpRatio, 0.08));
  this.hpLagBar.width = 210 * s.bossHpLag;
  this.hpBar.width = 210 * bossHpRatio;
}

function drawCorridor(scene) {
  const g = scene.corridor;
  const offset = (scene.state.walkScroll * 180) % 82;
  drawProjectedFloor(scene);
  g.clear();
  g.fillStyle(0x070808, 0.12).fillRect(0, 0, W, H);
  drawWalls(g, offset);
  drawProps(scene);

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
    if (scene.state.phase === "walk") prop.z -= 0.0012;
    if (prop.z <= 0.02) resetProp(scene, prop, 1);
    const p = 1 - prop.z;
    const roadWidth = Phaser.Math.Linear(58, 455, p * p);
    const side = prop.side < 0 ? -1 : 1;
    const y = 300 + Math.pow(p, 1.28) * 580;
    const scale = (0.11 + p * 0.38) * prop.size;
    const halfSprite = prop.frame.w * scale * 0.5;
    const roadEdge = W / 2 + side * (roadWidth / 2);
    const margin = prop.frame.key === "rubbleProps" ? 32 : 20;
    const fixedLaneX = W / 2 + side * prop.lane;
    const minOutsideX = roadEdge + side * (halfSprite + margin);
    const x = side < 0 ? Math.min(fixedLaneX, minOutsideX) : Math.max(fixedLaneX, minOutsideX);
    const clampedX = Phaser.Math.Clamp(x, halfSprite + 6, W - halfSprite - 6);
    prop.sprite.setVisible(y > 300 && clampedX > halfSprite && clampedX < W - halfSprite).setTexture(prop.frame.key).setCrop(prop.frame.x, prop.frame.y, prop.frame.w, prop.frame.h);
    prop.sprite.setOrigin(0.5, 1);
    prop.sprite.setPosition(clampedX, y).setScale(scale).setAlpha(Phaser.Math.Clamp(0.18 + p * 0.72, 0.18, 0.82)).setDepth(p > 0.78 ? 3 : 2);
  }
}

function resetProp(scene, prop, z) {
  const frame = Phaser.Utils.Array.GetRandom(scene.propFrames);
  Object.assign(prop, { frame, z, side: Math.random() < 0.5 ? -1 : 1, lane: Phaser.Math.FloatBetween(225, 255), size: Phaser.Math.FloatBetween(0.75, 1.2) });
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
  const speed = scene.state.walkScroll * 320;
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
  const speed = scene.state.walkScroll * 320;
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
  scene.state.enemyHurt = 0;
  scene.state.bossHurt = 0;
  scene.state.counterTimer = 0;
  scene.state.enemyDash = 0;
  scene.state.enemyFlash = 0;
  scene.state.enemyHpLag = 1;
  scene.sfx.walk.stop();
  safePlay(scene.sfx.encounter);
  scene.enemy.setTexture(p.kind).setAngle(0).setAlpha(1).clearTint().setVisible(true);
  scene.enemyHpBg.setVisible(true);
  scene.enemyHpLagBar.setVisible(true);
  scene.enemyHpBar.setVisible(true);
  updateEnemyHp(scene, p);
  scene.log.setText(`${p.name} 등장. 보스가 자동 공격을 준비한다.`);
}

function fightTick(scene, dt) {
  const s = scene.state;
  const p = scene.parties[s.encounter];
  s.enemyZ = Math.max(0.18, s.enemyZ - dt * 0.34);
  s.enemyHurt = Math.max(0, s.enemyHurt - dt);
  s.bossHurt = Math.max(0, s.bossHurt - dt);
  s.enemyDash = Math.max(0, s.enemyDash - dt);
  s.enemyFlash = Math.max(0, s.enemyFlash - dt);
  const k = 1 - s.enemyZ;
  const breathe = 1 + Math.sin(s.timer * 5) * 0.035;
  const recoil = s.enemyHurt > 0 ? Math.sin(s.enemyHurt * 38) * 16 : 0;
  const dash = s.enemyDash > 0 ? Math.sin((1 - s.enemyDash / 0.18) * Math.PI) * 70 : 0;
  scene.enemy.setPosition(W / 2 + Math.sin(s.timer * 2.4) * 5, 185 + k * 360 + Math.sin(s.timer * 5) * 3 - recoil + dash);
  scene.enemy.setTint(s.enemyFlash > 0 && Math.floor(s.enemyFlash * 28) % 2 === 0 ? 0xff3b2f : 0xffffff);
  scene.enemy.setScale((0.05 + k * 0.22) * breathe * (s.enemyHurt > 0 ? 1.04 : 1));
  updateEnemyHp(scene, p);

  if (s.enemyZ > 0.2) {
    s.hitTimer = 0;
    scene.log.setText(`${p.name} 접근 중. 가까이 오면 턴 전투가 시작된다.`);
    return;
  }

  if (s.counterTimer > 0) {
    s.counterTimer -= dt;
    if (s.counterTimer <= 0) {
      s.bossHp -= Math.max(1, p.atk - s.armor);
      s.bossHurt = 0.18;
      s.enemyDash = 0.18;
      safePlay(scene.sfx.hit);
      scene.flash.setAlpha(0.3);
      scene.cameras.main.shake(110, 0.007);
      scene.log.setText(`${p.name} 반격  |  보스 HP ${Math.max(0, Math.ceil(s.bossHp))}`);
      if (s.bossHp <= 0) end(scene, "패배 - 용사들이 던전 코어를 탈환했다");
    }
    return;
  }

  s.hitTimer += dt;
  if (s.hitTimer < 0.95) return;
  s.hitTimer = 0;
  p.hp -= s.attack;
  s.enemyHurt = 0.22;
  s.enemyFlash = 0.28;
  safePlay(scene.sfx.attack);
  safePlay(scene.sfx.hit);
  updateEnemyHp(scene, p);
  scene.log.setText(`보스 공격  |  ${p.name} HP ${Math.max(0, p.hp)}  |  반격 대기`);
  if (p.hp <= 0) return showDefeated(scene, p);
  s.counterTimer = 0.34;
}

function updateEnemyHp(scene, party) {
  const maxHp = party.maxHp || party.hp;
  party.maxHp = maxHp;
  const ratio = Phaser.Math.Clamp(party.hp / Math.max(1, maxHp), 0, 1);
  const width = Math.max(42, scene.enemy.displayWidth * 0.62);
  const x = scene.enemy.x;
  const y = scene.enemy.y - scene.enemy.displayHeight * 0.56 - 10;
  scene.state.enemyHpLag = Math.max(ratio, Phaser.Math.Linear(scene.state.enemyHpLag, ratio, 0.08));
  const lagRatio = scene.state.enemyHpLag;
  const flash = scene.state.enemyFlash > 0 && Math.floor(scene.state.enemyFlash * 28) % 2 === 0;
  scene.enemyHpBg.setFillStyle(flash ? 0x5a0907 : 0x1a1a18).setPosition(x, y).setSize(width, 7);
  scene.enemyHpLagBar.setFillStyle(flash ? 0xff9b2f : 0xf0b24b).setPosition(x - width * (1 - lagRatio) / 2, y).setSize(width * lagRatio, 7);
  scene.enemyHpBar.setFillStyle(flash ? 0xff2f24 : 0xd84a3a).setPosition(x - width * (1 - ratio) / 2, y).setSize(width * ratio, 7);
}

function showDefeated(scene, party) {
  scene.state.phase = "defeated";
  scene.state.defeatedTimer = 0.8;
  scene.enemy.setTint(0x8b8b8b).setAngle(-82).setAlpha(0.72).setVisible(true);
  scene.enemyHpBg.setVisible(false);
  scene.enemyHpLagBar.setVisible(false);
  scene.enemyHpBar.setVisible(false);
  scene.defeatedText.setText(`${party.name} 기절`).setVisible(true);
  scene.log.setText(`${party.name} 제압 완료.`);
}

function absorbReward(scene, party) {
  scene.state.phase = "reward";
  scene.state.rewardTimer = 1.2;
  scene.enemy.setVisible(false).setAngle(0).setAlpha(1).clearTint();
  scene.enemyHpBg.setVisible(false);
  scene.enemyHpLagBar.setVisible(false);
  scene.enemyHpBar.setVisible(false);
  applyReward(scene.state, party.reward);
  scene.defeatedText.setVisible(false);
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
    s.bossHpLag = Math.max(s.bossHpLag, s.bossHp / s.bossMaxHp);
  }
  if (reward.includes("흡혈")) {
    s.bossHp = Math.min(s.bossMaxHp, s.bossHp + n);
    s.bossHpLag = Math.max(s.bossHpLag, s.bossHp / s.bossMaxHp);
  }
  if (reward.includes("자원")) s.gold += n;
}

function nextEncounter(scene) {
  const s = scene.state;
  scene.rewardText.setVisible(false);
  scene.defeatedText.setVisible(false);
  s.encounter += 1;
  if (s.encounter >= scene.parties.length) return end(scene, "클리어 - 침입자를 모두 처치하고 던전 자원을 회수했다");
  s.phase = "walk";
  scene.log.setText("다음 용사 파티를 향해 자동 전진한다.");
}

function end(scene, message) {
  scene.state.phase = "end";
  scene.sfx.walk.stop();
  scene.sfx.bgm.stop();
  safePlay(message.startsWith("클리어") ? scene.sfx.win : scene.sfx.lose);
  scene.enemy.setVisible(false);
  scene.enemyHpBg.setVisible(false);
  scene.enemyHpLagBar.setVisible(false);
  scene.enemyHpBar.setVisible(false);
  scene.rewardText.setVisible(false);
  scene.defeatedText.setVisible(false);
  scene.startPanel.setVisible(true);
  scene.startText.setText(message.startsWith("클리어") ? "CLEAR" : "FAILED").setVisible(true);
  scene.startButton.setText("").setVisible(false).disableInteractive();
  scene.startHit.setVisible(false).disableInteractive().setAlpha(0);
  scene.log.setText(message);
}

function returnToStart(scene) {
  scene.sound.stopAll();
  scene.scene.restart();
}

function startWalkSound(scene) {
  if (!scene.sfx.bgm.isPlaying) safePlay(scene.sfx.bgm);
  if (!scene.sfx.walk.isPlaying) safePlay(scene.sfx.walk);
}

function startGame(scene) {
  scene.startButton.setText("START");
  scene.startHit.setAlpha(0.92);
  scene.state.phase = "walk";
  scene.startPanel.setVisible(false);
  scene.startText.setVisible(false);
  scene.startSound.setVisible(false);
  scene.startButton.setVisible(false).disableInteractive();
  scene.startHit.setVisible(false).disableInteractive();
  startWalkSound(scene);
}

function toggleSound(scene) {
  scene.state.soundOn = !scene.state.soundOn;
  scene.sound.mute = !scene.state.soundOn;
  drawSoundIcons(scene);
  if (scene.state.soundOn && scene.state.phase !== "start" && !scene.sfx.bgm.isPlaying) safePlay(scene.sfx.bgm);
}

function safePlay(sound) {
  try { sound.play(); } catch (_) {}
}

function drawSoundIcons(scene) {
  drawSpeaker(scene.soundToggle, W - 52, 86, scene.state.soundOn, 2);
  drawSpeaker(scene.startSound, W / 2 - 18, H / 2 - 10, scene.state.soundOn, 3);
}

function drawSpeaker(g, x, y, on, px) {
  g.clear();
  g.fillStyle(0x050606, 0.7).fillRect(x - 10, y - 10, 36, 30);
  g.lineStyle(px, 0xf4f1e8, 1).strokeRect(x - 10, y - 10, 36, 30);
  g.fillStyle(0xf4f1e8, 1);
  g.fillRect(x - 3, y + 1, 7, 10);
  g.fillRect(x + 4, y - 3, 6, 18);
  g.fillTriangle(x + 10, y - 4, x + 19, y - 10, x + 19, y + 20);
  if (on) {
    g.lineStyle(px, 0x9fe870, 1);
    g.lineBetween(x + 23, y - 2, x + 27, y + 4);
    g.lineBetween(x + 27, y + 4, x + 23, y + 10);
  } else {
    g.lineStyle(px + 1, 0xff3b2f, 1);
    g.lineBetween(x + 24, y - 3, x + 34, y + 15);
    g.lineBetween(x + 34, y - 3, x + 24, y + 15);
  }
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
