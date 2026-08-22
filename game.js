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
  drawLoadingScreen(this);
  this.load.image("floor", "godot/assets/generated_webp/floor_road.webp");
  this.load.image("wall", "godot/assets/generated_webp/wall_side.webp");
  this.load.image("cavePropsRaw", "godot/assets/generated_webp/cave_props.webp");
  this.load.image("rubblePropsRaw", "godot/assets/generated_webp/rubble_props.webp");
  this.load.image("warrior", "godot/assets/generated_webp/warrior2.webp");
  this.load.image("archer", "godot/assets/generated_webp/archer2.webp");
  this.load.audio("walk", "audio_compressed/walk.mp3");
  this.load.audio("encounter", "audio_compressed/encounter.mp3");
  this.load.audio("attack", "audio_compressed/attack.mp3");
  this.load.audio("hit", "audio_compressed/hit.mp3");
  this.load.audio("win", "audio_compressed/win.mp3");
  this.load.audio("lose", "audio_compressed/lose.mp3");
  this.load.audio("bgm", "audio_compressed/bgm.mp3");
  this.load.image("soundOnIcon", "assets/ui_webp/sound-on.webp");
  this.load.image("soundOffIcon", "assets/ui_webp/sound-off.webp");
  this.load.image("fullscreenEnterIcon", "assets/ui_webp/fullscreen-enter.webp");
  this.load.image("fullscreenExitIcon", "assets/ui_webp/fullscreen-exit.webp");
}

function create() {
  this.loadingGroup?.destroy(true);
  this.state = {
    phase: "start",
    mode: "scroll",
    rayX: 2.5,
    rayY: 8.5,
    rayDir: -Math.PI / 2,
    soundOn: false,
    fullscreenOn: false,
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
  this.soundToggle = this.add.image(W - 98, 86, "soundOffIcon").setDisplaySize(44, 44).setDepth(31).setInteractive({ useHandCursor: true });
  this.fullscreenToggle = this.add.image(W - 46, 86, "fullscreenEnterIcon").setDisplaySize(44, 44).setDepth(31).setInteractive({ useHandCursor: true });
  this.soundToggle.on("pointerdown", () => toggleSound(this));
  this.fullscreenToggle.on("pointerdown", () => toggleFullscreen(this));
  this.startPanel = this.add.rectangle(W / 2, H / 2, W, H, 0x050606, 0.72).setDepth(40);
  this.startText = text(this, W / 2, H / 2 - 74, "", 44).setOrigin(0.5).setDepth(41);
  this.startModeA = text(this, W / 2 - 132, H / 2 - 68, "SCROLL", 15).setOrigin(0.5).setDepth(41).setInteractive({ useHandCursor: true });
  this.startModeB = text(this, W / 2, H / 2 - 68, "PSEUDO-3D", 15).setOrigin(0.5).setDepth(41).setInteractive({ useHandCursor: true });
  this.startModeC = text(this, W / 2 + 132, H / 2 - 68, "BOARD", 15).setOrigin(0.5).setDepth(41).setInteractive({ useHandCursor: true });
  this.startSound = this.add.image(W / 2 - 46, H / 2, "soundOffIcon").setDisplaySize(58, 58).setDepth(41).setInteractive({ useHandCursor: true });
  this.startFullscreen = this.add.image(W / 2 + 46, H / 2, "fullscreenEnterIcon").setDisplaySize(58, 58).setDepth(41).setInteractive({ useHandCursor: true });
  this.startHit = this.add.rectangle(W / 2, H / 2 + 72, 190, 62, 0x2a211b, 0.92).setDepth(41).setInteractive({ useHandCursor: true });
  this.startHit.setStrokeStyle(3, 0xf4f1e8, 0.9);
  this.startButton = text(this, W / 2, H / 2 + 72, "START", 26).setOrigin(0.5).setDepth(42).setInteractive({ useHandCursor: true });
  this.startModeA.on("pointerdown", () => setMode(this, "scroll"));
  this.startModeB.on("pointerdown", () => setMode(this, "raycast"));
  this.startModeC.on("pointerdown", () => setMode(this, "board"));
  this.startSound.on("pointerdown", () => toggleSound(this));
  this.startFullscreen.on("pointerdown", () => toggleFullscreen(this));
  drawUiIcons(this);
  setMode(this, "scroll");
  this.startHit.on("pointerdown", () => startGame(this));
  this.startButton.on("pointerdown", () => startGame(this));
  document.addEventListener("fullscreenchange", () => {
    this.state.fullscreenOn = !!document.fullscreenElement;
    drawUiIcons(this);
  });

  this.input.keyboard.on("keydown", (e) => {
    if (this.state.phase === "start" && e.code === "Space") startGame(this);
    if (this.state.phase === "end" && e.code === "Space") returnToStart(this);
  });
}

function update(_, deltaMs) {
  const dt = deltaMs / 1000;
  const s = this.state;
  s.timer += dt;
  if (s.mode === "board" && s.phase === "board") return updateBoard(this, dt);
  drawCorridor(this);
  this.flash.setAlpha(Math.max(0, this.flash.alpha - dt * 4));

  if (s.phase === "walk") {
    startWalkSound(this);
    s.road += dt * 0.5;
    s.walkScroll += dt * 0.5;
    if (s.mode === "raycast") advanceRay(this, dt * 0.65);
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
  if (scene.state.mode === "raycast") return drawRaycastView(scene);
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
  if (scene.state.mode === "board") return startBoardMode(scene);
  scene.state.phase = "walk";
  scene.startPanel.setVisible(false);
  scene.startText.setVisible(false);
  scene.startModeA.setVisible(false);
  scene.startModeB.setVisible(false);
  scene.startModeC.setVisible(false);
  scene.startSound.setVisible(false);
  scene.startFullscreen.setVisible(false);
  scene.startButton.setVisible(false).disableInteractive();
  scene.startHit.setVisible(false).disableInteractive();
  startWalkSound(scene);
}

function setMode(scene, mode) {
  scene.state.mode = mode;
  scene.startModeA.setColor(mode === "scroll" ? "#f0b24b" : "#f4f1e8");
  scene.startModeB.setColor(mode === "raycast" ? "#f0b24b" : "#f4f1e8");
  scene.startModeC.setColor(mode === "board" ? "#f0b24b" : "#f4f1e8");
}

function toggleSound(scene) {
  scene.state.soundOn = !scene.state.soundOn;
  scene.sound.mute = !scene.state.soundOn;
  drawUiIcons(scene);
  if (scene.state.soundOn && scene.state.phase !== "start" && !scene.sfx.bgm.isPlaying) safePlay(scene.sfx.bgm);
}

function safePlay(sound) {
  try { sound.play(); } catch (_) {}
}

function drawUiIcons(scene) {
  scene.soundToggle.setTexture(scene.state.soundOn ? "soundOnIcon" : "soundOffIcon");
  scene.startSound.setTexture(scene.state.soundOn ? "soundOnIcon" : "soundOffIcon");
  scene.fullscreenToggle.setTexture(scene.state.fullscreenOn ? "fullscreenExitIcon" : "fullscreenEnterIcon");
  scene.startFullscreen.setTexture(scene.state.fullscreenOn ? "fullscreenExitIcon" : "fullscreenEnterIcon");
}

function toggleFullscreen(scene) {
  const el = scene.game.canvas.parentElement || scene.game.canvas;
  if (document.fullscreenElement) document.exitFullscreen?.();
  else el.requestFullscreen?.().catch?.(() => {});
  setTimeout(() => {
    scene.state.fullscreenOn = !!document.fullscreenElement;
    drawUiIcons(scene);
  }, 120);
}

const RAY_MAP = [
  "1111111",
  "1000001",
  "1011101",
  "1000101",
  "1110101",
  "1000001",
  "1011111",
  "1000001",
  "1111111",
];

function advanceRay(scene, step) {
  const s = scene.state;
  const nx = s.rayX + Math.cos(s.rayDir) * step;
  const ny = s.rayY + Math.sin(s.rayDir) * step;
  if (RAY_MAP[Math.floor(ny)]?.[Math.floor(nx)] === "0") { s.rayX = nx; s.rayY = ny; return; }
  s.rayDir += Math.PI / 2;
}

function drawRaycastView(scene) {
  const g = scene.corridor;
  const tex = scene.floorCanvas;
  const ctx = tex.context;
  const wall = scene.textures.get("wall").getSourceImage();
  const floor = scene.textures.get("floor").getSourceImage();
  const fov = Math.PI / 3;
  const horizon = Math.floor(H * 0.48);
  ctx.clearRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#101615";
  ctx.fillRect(0, 0, W, horizon);

  const floorSpeed = scene.state.walkScroll * 280;
  for (let y = horizon; y < H; y += 4) {
    const p = (y - horizon) / (H - horizon);
    const depth = 1 / Math.max(0.05, p);
    const roadW = Phaser.Math.Linear(90, W * 1.35, p * p);
    const left = W / 2 - roadW / 2;
    const sampleW = Math.floor(floor.width * Phaser.Math.Clamp(0.45 + p * 0.5, 0.45, 0.95));
    const sampleX = Math.floor((floor.width - sampleW) / 2);
    const sampleY = Math.floor((floorSpeed + depth * 220) % (floor.height - 24));
    const sampleH = Math.floor(8 + p * 28);
    ctx.globalAlpha = Phaser.Math.Clamp(0.35 + p * 0.7, 0.35, 1);
    ctx.drawImage(floor, sampleX, sampleY, sampleW, sampleH, left, y, roadW, 4);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, horizon, W, 80);

  for (let x = 0; x < W; x += 3) {
    const ray = scene.state.rayDir - fov / 2 + (x / W) * fov;
    let dist = 0.05, hitX = 0, hitY = 0, hit = false;
    while (!hit && dist < 8) {
      hitX = scene.state.rayX + Math.cos(ray) * dist;
      hitY = scene.state.rayY + Math.sin(ray) * dist;
      hit = RAY_MAP[Math.floor(hitY)]?.[Math.floor(hitX)] !== "0";
      if (!hit) dist += 0.025;
    }
    const corrected = dist * Math.cos(ray - scene.state.rayDir);
    const wallH = Math.min(H, H / Math.max(0.18, corrected));
    const y = H / 2 - wallH / 2 + 80;
    const fracX = Math.abs(hitX - Math.floor(hitX));
    const fracY = Math.abs(hitY - Math.floor(hitY));
    const sampleX = Math.floor((Math.abs(fracX - 0.5) > Math.abs(fracY - 0.5) ? fracY : fracX) * wall.width) % wall.width;
    ctx.globalAlpha = Phaser.Math.Clamp(1.05 - corrected * 0.1, 0.35, 0.95);
    ctx.drawImage(wall, sampleX, 0, 3, wall.height, x, y, 3, wallH);
    ctx.fillStyle = `rgba(0,0,0,${Phaser.Math.Clamp(corrected * 0.08, 0.05, 0.55)})`;
    ctx.fillRect(x, y, 3, wallH);
  }
  ctx.globalAlpha = 1;
  tex.refresh();
  g.clear();
  g.fillStyle(0x000000, 0.16).fillRect(0, 0, W, H);
  for (const prop of scene.props) prop.sprite.setVisible(false);
}

function drawLoadingScreen(scene) {
  const g = scene.add.graphics().setDepth(100);
  const title = scene.add.text(W / 2, H / 2 - 76, "LOADING", {
    fontFamily: "system-ui, sans-serif",
    fontSize: "30px",
    fontStyle: "900",
    color: "#f4f1e8",
    stroke: "#050606",
    strokeThickness: 6,
  }).setOrigin(0.5).setDepth(101);
  const percent = scene.add.text(W / 2, H / 2 + 42, "0%", {
    fontFamily: "system-ui, sans-serif",
    fontSize: "18px",
    fontStyle: "800",
    color: "#f4f1e8",
    stroke: "#050606",
    strokeThickness: 4,
  }).setOrigin(0.5).setDepth(101);
  scene.loadingGroup = scene.add.container(0, 0, [g, title, percent]).setDepth(100);
  const paint = (value) => {
    g.clear();
    g.fillStyle(0x050606, 1).fillRect(0, 0, W, H);
    g.fillStyle(0x15100d, 1).fillRect(W / 2 - 156, H / 2 - 12, 312, 24);
    g.lineStyle(4, 0xf4c15d, 1).strokeRect(W / 2 - 156, H / 2 - 12, 312, 24);
    g.fillStyle(0xb43a35, 1).fillRect(W / 2 - 148, H / 2 - 4, 296 * value, 8);
    g.fillStyle(0xf0b24b, 1).fillRect(W / 2 - 148, H / 2 + 5, 296 * value, 4);
    percent.setText(`${Math.round(value * 100)}%`);
  };
  paint(0);
  scene.load.on("progress", paint);
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

function startBoardMode(scene) {
  scene.state.phase = "board";
  scene.startPanel.setVisible(false);
  scene.startText.setVisible(false);
  scene.startModeA.setVisible(false);
  scene.startModeB.setVisible(false);
  scene.startModeC.setVisible(false);
  scene.startSound.setVisible(false);
  scene.startFullscreen.setVisible(false);
  scene.startButton.setVisible(false).disableInteractive();
  scene.startHit.setVisible(false).disableInteractive();
  scene.enemy.setVisible(false);
  scene.enemyHpBg.setVisible(false);
  scene.enemyHpLagBar.setVisible(false);
  scene.enemyHpBar.setVisible(false);
  scene.board = {
    step: "choose",
    tab: "dungeon",
    selectedBoss: "slime",
    chosenName: "",
    dungeon: { name: "축축한 동굴", area: 18, floor: "B1F", households: 2, monsters: 12, capacity: 20, bosses: 1, asset: 1250, notoriety: 42, soul: 320, gem: 125, stage: 0 },
    bosses: [
      { id: "slime", name: "슬라임", lv: 3, hp: 80, maxHp: 80, atk: 18, def: 6, trait: "좁은 통로 통과 가능", status: "상주", recruited: true, discovered: true },
      { id: "bat", name: "외눈박이 그룸", lv: 1, hp: 65, maxHp: 65, atk: 14, def: 3, trait: "어둠 지역 탐색", status: "발견", recruited: false, discovered: true },
      { id: "orc", name: "오크 대장", lv: 2, hp: 120, maxHp: 120, atk: 24, def: 10, trait: "전투 보너스", status: "미발견", recruited: false, discovered: false },
      { id: "witch", name: "늪의 마녀", lv: 2, hp: 70, maxHp: 70, atk: 28, def: 4, trait: "약화 권능 강화", status: "미발견", recruited: false, discovered: false },
    ],
    areas: [
      { name: "버려진 폐광", diff: "★", req: 0, progress: 2, max: 4, done: false },
      { name: "지하 수로", diff: "★★", req: 60, progress: 1, max: 4, done: false },
      { name: "고대 묘지", diff: "★★", req: 200, progress: 0, max: 5, done: false },
    ],
    logs: ["던전 지배권을 확보했다.", "축축한 동굴 18평에서 시작한다."],
    battle: null,
    invasion: false,
    powerUsed: false,
    dwellers: Array.from({ length: 10 }, (_, i) => ({ x: 90 + (i % 5) * 80, y: 255 + Math.floor(i / 5) * 85, dx: (i % 2 ? 1 : -1) * 12, dy: (i % 3 ? 1 : -1) * 8 })),
    exploreRun: null,
  };
  renderBoard(scene);
}

function updateBoard(scene, dt) {
  scene.flash.setAlpha(Math.max(0, scene.flash.alpha - dt * 4));
  if (!scene.board) return;
  for (const m of scene.board.dwellers || []) {
    m.x += m.dx * dt; m.y += m.dy * dt;
    if (m.x < 55 || m.x > 470) m.dx *= -1;
    if (m.y < 220 || m.y > 465) m.dy *= -1;
  }
  if (scene.board.tab === "dungeon" && scene.board.step === "main") renderBoard(scene);
  if (scene.board.step !== "battle") return;
  const b = scene.board.battle;
  b.timer += dt;
  if (b.timer < 0.9 || b.result) return;
  b.timer = 0;
  b.heroHp = Math.max(0, b.heroHp - b.bossAtk);
  b.bossHp = Math.max(0, b.bossHp - b.heroAtk);
  scene.flash.setAlpha(0.16);
  scene.board.logs.unshift(`슬라임이 ${b.bossAtk} 피해, 용사가 ${b.heroAtk} 피해를 주었다.`);
  if (b.heroHp <= 0) {
    b.result = "win";
    scene.board.dungeon.soul += 60;
    scene.board.dungeon.notoriety += 18;
    scene.board.logs.unshift("용사 침입을 막아냈다. 악명 +18, Soul +60");
  } else if (b.bossHp <= 0) {
    b.result = "lose";
    scene.board.dungeon.notoriety = Math.max(0, scene.board.dungeon.notoriety - 10);
    scene.board.logs.unshift("방어 실패. 악명 -10");
  }
  renderBoard(scene);
}

function renderBoard(scene) {
  if (scene.boardUi) scene.boardUi.destroy(true);
  const c = scene.add.container(0, 0).setDepth(60);
  scene.boardUi = c;
  const b = scene.board;
  addRect(scene, c, 0, 0, W, H, 0x050606, 1);
  addText(scene, c, 18, 18, `악명 ${b.dungeon.notoriety}`, 15, "#d68cff");
  addText(scene, c, 150, 18, `Soul ${b.dungeon.soul}`, 15, "#f0c45c");
  addText(scene, c, 285, 18, `Gem ${b.dungeon.gem}`, 15, "#7fd8ff");
  if (b.step === "choose") return renderChoose(scene, c);
  if (b.step === "chosen") return renderChosenSlime(scene, c);
  if (b.step === "battle") return renderBattle(scene, c);
  if (b.step === "exploreRun") return renderExploreRun(scene, c);
  if (b.tab === "dungeon") renderDungeon(scene, c);
  if (b.tab === "explore") renderExplore(scene, c);
  if (b.tab === "boss") renderBosses(scene, c);
  if (b.tab === "record") renderRecords(scene, c);
  renderTabs(scene, c);
}

function renderChoose(scene, c) {
  addText(scene, c, 28, 120, "최초의 필드보스를 선택하십시오", 24, "#f4f1e8");
  [["오크 군주", 90], ["리치", 210], ["늪의 마녀", 330]].forEach(([name, x]) => {
    addButton(scene, c, x, 250, 110, 140, name, () => {
      scene.board.chosenName = name;
      scene.board.step = "chosen";
      scene.board.logs.unshift(`${name} 선택 요청이 접수되었다.`);
      renderBoard(scene);
    }, "power");
  });
  addText(scene, c, 42, 450, "무엇을 고르든 현재 던전이 감당 가능한 존재는 슬라임뿐이다.", 15, "#aab0aa");
}

function renderChosenSlime(scene, c) {
  addText(scene, c, 32, 92, `${scene.board.chosenName} 소환 의식`, 26, "#f4f1e8");
  addPanel(scene, c, 32, 148, 476, 110, ["심사 결과", "던전 규모: 18평", "마력 수용량: 매우 낮음", "권장 필드보스 등급: 하급"]);
  addText(scene, c, 56, 322, "실제 배정 필드보스", 18, "#aab0aa");
  addSlime(scene, c, W / 2, 430, 2.4);
  addText(scene, c, W / 2 - 42, 510, "슬라임", 34, "#8cff7a");
  addText(scene, c, 44, 575, "축하합니다. 현재 던전에는 이 정도가 딱 맞습니다.", 16, "#f0b24b");
  addButton(scene, c, 150, 660, 240, 72, "던전 입주", () => {
    scene.board.step = "main";
    scene.board.logs.unshift(`${scene.board.chosenName} 대신 슬라임이 입주했다.`);
    renderBoard(scene);
  }, "growth");
}

function renderDungeon(scene, c) {
  const d = scene.board.dungeon;
  addText(scene, c, 24, 80, d.name, 28, "#f4f1e8");
  addText(scene, c, 24, 122, `${d.area}평   ${d.floor}   ${d.households}세대`, 17, "#c9c2b8");
  [["습지", 76, 300], ["거주구", 220, 230], ["입구", 368, 300], ["훈련장", 220, 430]].forEach(([n,x,y]) => {
    addRect(scene, c, x-48, y-38, 96, 76, 0x101513, 1, 0x2d3930);
    addText(scene, c, x-28, y-8, n, 16, "#f4f1e8");
  });
  addSlime(scene, c, 78, 330, 1.1);
  for (const m of scene.board.dwellers) {
    const dot = scene.add.circle(m.x, m.y, 4, 0x8bd17c, 0.9).setDepth(62);
    c.add(dot);
  }
  if (!scene.board.invasion) addButton(scene, c, 24, 555, 220, 74, "침입 경고 발생", () => { scene.board.invasion = true; scene.board.logs.unshift("거주구 쪽에서 용사 침입 경고가 울렸다."); renderBoard(scene); }, "danger");
  else addPanel(scene, c, 24, 535, 220, 104, ["용사 침입!", "B1F · 거주구", "발생 시간 09:27"]), addButton(scene, c, 78, 608, 112, 34, "대응하기", () => startBoardBattle(scene), "danger");
  addButton(scene, c, 270, 555, 220, 74, d.stage === 0 ? "42평 확장" : d.stage === 1 ? "84평 확장" : "확장 완료", () => expandDungeon(scene), "growth");
  addPanel(scene, c, 24, 665, 492, 130, ["던전 현황", `입주 몬스터 ${d.monsters}/${d.capacity}`, `상주 필드보스 ${d.bosses}`, `자산 가치 ${d.asset} Soul`]);
}

function renderExplore(scene, c) {
  addText(scene, c, 24, 76, "탐험 지역", 26, "#f4f1e8");
  scene.board.areas.forEach((a, i) => {
    const y = 135 + i * 132;
    const locked = scene.board.dungeon.notoriety < a.req;
    addRect(scene, c, 24, y, 492, 105, locked ? 0x0b0d0d : 0x101513, 1, locked ? 0x333333 : 0x314832);
    addText(scene, c, 42, y + 18, `${a.name}  난이도 ${a.diff}`, 18, locked ? "#777" : "#f4f1e8");
    addText(scene, c, 42, y + 52, locked ? `악명 ${a.req} 필요` : `발견 ${a.progress}/${a.max}`, 15, locked ? "#c55" : "#8bd17c");
    if (!locked) addButton(scene, c, 388, y + 30, 92, 42, "탐험", () => startExploreRun(scene, i), "explore");
  });
}

function renderBosses(scene, c) {
  addText(scene, c, 24, 76, "필드보스 목록", 26, "#f4f1e8");
  scene.board.bosses.forEach((boss, i) => {
    const y = 130 + i * 128;
    addRect(scene, c, 24, y, 492, 105, boss.recruited ? 0x102010 : 0x101313, 1, boss.recruited ? 0x3b8b3b : 0x333b3b);
    if (boss.id === "slime") addSlime(scene, c, 70, y + 55, 0.9); else addText(scene, c, 56, y + 36, boss.discovered ? "?" : "??", 34, "#777");
    addText(scene, c, 120, y + 20, boss.discovered ? boss.name : "???", 19, "#f4f1e8");
    addText(scene, c, 120, y + 52, boss.recruited ? `Lv.${boss.lv}  ATK ${boss.atk}  HP ${boss.hp}` : boss.status, 15, "#c9c2b8");
    addText(scene, c, 120, y + 76, boss.discovered ? boss.trait : "미발견", 14, "#8bd17c");
  });
}

function renderBattle(scene, c) {
  const b = scene.board.battle;
  addText(scene, c, 24, 78, "용사 침입!", 28, "#ff5555");
  addText(scene, c, 24, 120, "B1F · 거주구", 17, "#c9c2b8");
  addSlime(scene, c, 120, 270, 1.7);
  addText(scene, c, 350, 250, "용사 파티", 20, "#f4f1e8");
  addText(scene, c, 370, 295, "⚔  ⚔  ✚", 26, "#d9d0c2");
  drawHp(scene, c, 70, 390, 170, b.bossHp / b.bossMax, "슬라임", `${b.bossHp}/${b.bossMax}`);
  drawHp(scene, c, 300, 390, 170, b.heroHp / b.heroMax, "용사 파티", `${b.heroHp}/${b.heroMax}`);
  addText(scene, c, 24, 505, "지배자의 권능", 20, "#f4f1e8");
  const powerKind = scene.board.powerUsed ? "disabled" : "power";
  addButton(scene, c, 24, 545, 145, 60, "회복", () => usePower(scene, "heal"), powerKind);
  addButton(scene, c, 198, 545, 145, 60, "약화", () => usePower(scene, "weaken"), powerKind);
  addButton(scene, c, 372, 545, 145, 60, "보호막", () => usePower(scene, "shield"), powerKind);
  if (b.result) addButton(scene, c, 150, 645, 240, 62, b.result === "win" ? "결과 반영" : "귀환", () => { scene.board.step = "main"; scene.board.tab = "dungeon"; renderBoard(scene); }, "primary");
  addPanel(scene, c, 24, 730, 492, 150, scene.board.logs.slice(0, 5));
}

function renderRecords(scene, c) {
  addText(scene, c, 24, 76, "기록", 26, "#f4f1e8");
  addPanel(scene, c, 24, 130, 492, 620, scene.board.logs.slice(0, 12));
}

function renderTabs(scene, c) {
  [["던전","dungeon",20],["탐험","explore",150],["보스","boss",280],["기록","record",410]].forEach(([label, tab, x]) => {
    addButton(scene, c, x, H - 86, 110, 58, label, () => { scene.board.tab = tab; renderBoard(scene); }, scene.board.tab === tab ? "tabActive" : "tab");
  });
}

function startExploreRun(scene, idx) {
  const area = scene.board.areas[idx];
  scene.board.step = "exploreRun";
  scene.board.exploreRun = { idx, node: 0, nodes: ["입구 정찰", "자원 발견", idx === 0 ? "낯선 흔적" : "귀환로 확보"] };
  scene.board.logs.unshift(`${area.name} 탐험을 시작했다.`);
  renderBoard(scene);
}

function renderExploreRun(scene, c) {
  const run = scene.board.exploreRun;
  const area = scene.board.areas[run.idx];
  addText(scene, c, 24, 76, area.name, 26, "#f4f1e8");
  addText(scene, c, 24, 116, "슬라임이 외부 지역을 탐험 중", 16, "#c9c2b8");
  run.nodes.forEach((n, i) => {
    const x = 78 + i * 155;
    addRect(scene, c, x - 42, 235, 84, 84, i < run.node ? 0x17361d : i === run.node ? 0x143048 : 0x101313, 1, i <= run.node ? 0x54aee8 : 0x333b3b);
    addText(scene, c, x - 32, 335, n, 14, i <= run.node ? "#f4f1e8" : "#777");
  });
  addPanel(scene, c, 32, 430, 476, 150, run.node === 0 ? ["사건", "폐광 입구가 무너져 있다.", "슬라임은 좁은 틈으로 통과할 수 있다."] : run.node === 1 ? ["발견", "낡은 Soul 광맥을 찾았다.", "탐험 보상: Soul +35"] : ["흔적", "벽면에 외눈박이 표식이 있다.", "새 필드보스의 존재가 확인됐다."]);
  addButton(scene, c, 150, 640, 240, 66, run.node >= run.nodes.length - 1 ? "귀환" : "다음 노드", () => progressExploreRun(scene), "explore");
}

function progressExploreRun(scene) {
  const run = scene.board.exploreRun;
  if (run.node < run.nodes.length - 1) { run.node += 1; scene.board.dungeon.soul += 35; scene.board.logs.unshift(`탐험 노드 진행: ${run.nodes[run.node]}`); return renderBoard(scene); }
  exploreArea(scene, run.idx);
  scene.board.step = "main";
  scene.board.tab = "explore";
  scene.board.exploreRun = null;
  renderBoard(scene);
}

function startBoardBattle(scene) {
  scene.board.step = "battle";
  scene.board.invasion = false;
  scene.board.powerUsed = false;
  scene.board.battle = { timer: 0, bossHp: 80, bossMax: 80, bossAtk: 18, heroHp: 60, heroMax: 60, heroAtk: 9, result: null };
  scene.board.logs.unshift("용사 파티가 던전에 침입했다.");
  renderBoard(scene);
}

function usePower(scene, type) {
  const b = scene.board.battle;
  if (!b || scene.board.powerUsed || b.result) return;
  scene.board.powerUsed = true;
  if (type === "heal") { b.bossHp = Math.min(b.bossMax, b.bossHp + 24); scene.board.logs.unshift("권능: 슬라임을 회복했다."); }
  if (type === "weaken") { b.heroAtk = Math.max(2, b.heroAtk - 5); scene.board.logs.unshift("권능: 용사 파티를 약화했다."); }
  if (type === "shield") { b.heroAtk = Math.max(1, Math.floor(b.heroAtk / 2)); scene.board.logs.unshift("권능: 보호막을 펼쳤다."); }
  renderBoard(scene);
}

function exploreArea(scene, idx) {
  const area = scene.board.areas[idx];
  area.progress = Math.min(area.max, area.progress + 1);
  scene.board.dungeon.soul += 35;
  scene.board.logs.unshift(`${area.name} 탐험 진행. Soul +35`);
  if (idx === 0 && area.progress >= area.max && !scene.board.bosses[1].recruited) {
    scene.board.bosses[1].recruited = true;
    scene.board.bosses[1].status = "상주";
    scene.board.dungeon.bosses += 1;
    scene.board.logs.unshift("새 필드보스 외눈박이 그룸을 영입했다.");
  }
  renderBoard(scene);
}

function expandDungeon(scene) {
  const d = scene.board.dungeon;
  if (d.stage === 0 && d.soul >= 180) { d.stage = 1; d.area = 42; d.households = 4; d.capacity = 32; d.asset = 2400; d.soul -= 180; scene.board.logs.unshift("던전을 42평으로 확장했다."); }
  else if (d.stage === 1 && d.soul >= 360) { d.stage = 2; d.area = 84; d.floor = "B2F"; d.households = 8; d.capacity = 56; d.asset = 5200; d.soul -= 360; scene.board.logs.unshift("B2F를 열고 84평으로 확장했다."); }
  else scene.board.logs.unshift("확장에 필요한 Soul이 부족하다.");
  renderBoard(scene);
}

function addRect(scene, c, x, y, w, h, fill, alpha = 1, stroke = null) {
  const r = scene.add.rectangle(x, y, w, h, fill, alpha).setOrigin(0).setDepth(60);
  if (stroke !== null) r.setStrokeStyle(1, stroke, 1);
  c.add(r); return r;
}

function addText(scene, c, x, y, value, size, color = "#f4f1e8") {
  const t = scene.add.text(x, y, value, { fontFamily: "system-ui, sans-serif", fontSize: `${size}px`, fontStyle: "800", color, stroke: "#050606", strokeThickness: 3 }).setDepth(61);
  c.add(t); return t;
}

function addButton(scene, c, x, y, w, h, label, fn, kind = "default") {
  const styles = {
    default: [0x151817, 0x343b38, "#f4f1e8"],
    primary: [0x1e3f68, 0x66b6ff, "#d9efff"],
    danger: [0x3a1214, 0xd85252, "#ffb2a8"],
    growth: [0x17361d, 0x69c95f, "#b6ff9c"],
    explore: [0x143048, 0x54aee8, "#b8e8ff"],
    power: [0x351846, 0xb96cff, "#efc9ff"],
    disabled: [0x191919, 0x333333, "#777777"],
    tab: [0x101313, 0x2f3635, "#c9c2b8"],
    tabActive: [0x1d4a22, 0x65c45c, "#9cff8a"],
  };
  const [fill, stroke, color] = styles[kind] || styles.default;
  const r = addRect(scene, c, x, y, w, h, fill, 1, stroke).setInteractive({ useHandCursor: kind !== "disabled" });
  const t = addText(scene, c, x + w / 2, y + h / 2 - 10, label, 16, color).setOrigin(0.5);
  if (kind !== "disabled") { r.on("pointerdown", fn); t.setInteractive({ useHandCursor: true }).on("pointerdown", fn); }
  return r;
}

function addPanel(scene, c, x, y, w, h, lines) {
  addRect(scene, c, x, y, w, h, 0x0c0f0e, 1, 0x29312e);
  lines.forEach((line, i) => addText(scene, c, x + 16, y + 16 + i * 28, line, i === 0 ? 17 : 14, i === 0 ? "#f4f1e8" : "#c9c2b8"));
}

function addSlime(scene, c, x, y, scale = 1) {
  const body = scene.add.ellipse(x, y, 46 * scale, 34 * scale, 0x42c95a, 1).setDepth(61).setStrokeStyle(3, 0x173d1d);
  const e1 = scene.add.circle(x - 10 * scale, y - 3 * scale, 3 * scale, 0x050606).setDepth(62);
  const e2 = scene.add.circle(x + 10 * scale, y - 3 * scale, 3 * scale, 0x050606).setDepth(62);
  c.add([body, e1, e2]);
}

function drawHp(scene, c, x, y, w, ratio, name, value) {
  addText(scene, c, x, y - 28, name, 15, "#f4f1e8");
  addRect(scene, c, x, y, w, 12, 0x1a1a18, 1);
  addRect(scene, c, x, y, w * Math.max(0, ratio), 12, ratio > 0.35 ? 0x54c845 : 0xd8483a, 1);
  addText(scene, c, x, y + 18, value, 14, "#c9c2b8");
}
