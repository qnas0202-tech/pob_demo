const W = 540;
const H = 960;
const DUNGEON_ACTOR_BOUNDS = { x1: 36, y1: 250, x2: 504, y2: 626 };
const UI_THEME = {
  bg: 0x050606,
  panel: 0x10130f,
  panel2: 0x171b15,
  border: 0x4b5a42,
  borderHot: 0xb9a05a,
  ink: "#e4dac5",
  muted: "#9c9787",
  green: "#8bd17c",
  gold: "#d4b35f",
  red: "#d85a4a",
};

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
  this.load.scenePlugin("rexuiplugin", "https://cdn.jsdelivr.net/gh/rexrainbow/phaser3-rex-notes@master/dist/rexuiplugin.min.js", "rexUI", "rexUI");
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
  this.load.image("pdTiles", "2D Pixel Dungeon Asset Pack/character and tileset/Dungeon_Tileset.png");
  this.load.image("pdCharacters", "2D Pixel Dungeon Asset Pack/character and tileset/Dungeon_Character.png");
  this.load.image("pdSkeleton", "Enemy_Animations_Set/enemies-skeleton1_idle.png");
  this.load.image("pdVampire", "Enemy_Animations_Set/enemies-vampire_idle.png");
  this.load.image("pdChest", "2D Pixel Dungeon Asset Pack/items and trap_animation/chest/chest_1.png");
  this.load.image("pdTorch", "2D Pixel Dungeon Asset Pack/items and trap_animation/torch/torch_1.png");
  this.load.image("pdPeaks", "2D Pixel Dungeon Asset Pack/items and trap_animation/peaks/peaks_1.png");
  this.load.image("dungeonInterior", "assets/dungeon-interior.png");
}

function create() {
  this.loadingGroup?.destroy(true);
  this.state = {
    phase: "start",
    mode: "board",
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
  setRunHudVisible(this, false);
  this.soundToggle = this.add.image(W - 98, 86, "soundOffIcon").setDisplaySize(44, 44).setDepth(31).setInteractive({ useHandCursor: true });
  this.fullscreenToggle = this.add.image(W - 46, 86, "fullscreenEnterIcon").setDisplaySize(44, 44).setDepth(31).setInteractive({ useHandCursor: true });
  this.soundToggle.on("pointerdown", () => toggleSound(this));
  this.fullscreenToggle.on("pointerdown", () => toggleFullscreen(this));
  this.startPanel = this.add.rectangle(W / 2, H / 2, W, H, 0x050606, 0.86).setDepth(40);
  this.startDecor = [
    this.add.rectangle(W / 2, H / 2, 420, 330, UI_THEME.panel, 0.92).setDepth(40).setStrokeStyle(2, UI_THEME.border, 0.9),
    this.add.rectangle(W / 2, H / 2 - 153, 360, 2, UI_THEME.borderHot, 0.85).setDepth(41),
    this.add.rectangle(W / 2, H / 2 + 153, 360, 2, UI_THEME.borderHot, 0.45).setDepth(41),
  ];
  this.startText = text(this, W / 2, H / 2 - 96, "18평: 회복편", 44, UI_THEME.ink).setOrigin(0.5).setDepth(41);
  this.startModeA = text(this, W / 2 - 150, H / 2 - 92, "SCROLL", 13).setOrigin(0.5).setDepth(41).setInteractive({ useHandCursor: true });
  this.startModeB = text(this, W / 2, H / 2 - 92, "PSEUDO-3D", 13).setOrigin(0.5).setDepth(41).setInteractive({ useHandCursor: true });
  this.startModeC = text(this, W / 2 + 150, H / 2 - 92, "BOARD", 13).setOrigin(0.5).setDepth(41).setInteractive({ useHandCursor: true });
  this.startModeD = text(this, W / 2 - 150, H / 2 - 62, "KING-3D", 13).setOrigin(0.5).setDepth(41).setInteractive({ useHandCursor: true });
  this.startModeE = text(this, W / 2, H / 2 - 62, "ABYSS", 13).setOrigin(0.5).setDepth(41).setInteractive({ useHandCursor: true });
  this.startModeF = text(this, W / 2 + 150, H / 2 - 62, "BOARD-TOUR", 13).setOrigin(0.5).setDepth(41).setInteractive({ useHandCursor: true });
  this.startSound = this.add.image(W - 98, 86, "soundOffIcon").setDisplaySize(50, 50).setDepth(41).setInteractive({ useHandCursor: true });
  this.startFullscreen = this.add.image(W - 42, 86, "fullscreenEnterIcon").setDisplaySize(50, 50).setDepth(41).setInteractive({ useHandCursor: true });
  this.startHit = this.add.rectangle(W / 2, H / 2 + 42, 230, 68, 0x2a211b, 0.92).setDepth(41).setInteractive({ useHandCursor: true });
  this.startHit.setStrokeStyle(3, 0xf4f1e8, 0.9);
  this.startButton = text(this, W / 2, H / 2 + 42, "시작하기", 26).setOrigin(0.5).setDepth(42).setInteractive({ useHandCursor: true });
  this.startRexButton = addRexButton(this, W / 2, H / 2 + 42, 230, 68, "시작하기", () => startGame(this));
  this.resetHit = this.add.rectangle(W / 2, H / 2 + 122, 190, 46, UI_THEME.panel2, 0.88).setDepth(41).setInteractive({ useHandCursor: true });
  this.resetHit.setStrokeStyle(2, UI_THEME.border, 0.9);
  this.resetText = text(this, W / 2, H / 2 + 122, "초기화", 18, UI_THEME.muted).setOrigin(0.5).setDepth(42).setInteractive({ useHandCursor: true });
  this.resetHit.on("pointerdown", () => showStartResetConfirm(this));
  this.resetText.on("pointerdown", () => showStartResetConfirm(this));
  if (this.startRexButton) {
    this.startHit.setVisible(false).disableInteractive();
    this.startButton.setVisible(false).disableInteractive();
  }
  this.startModeA.on("pointerdown", () => setMode(this, "scroll"));
  this.startModeB.on("pointerdown", () => setMode(this, "raycast"));
  this.startModeC.on("pointerdown", () => setMode(this, "board"));
  this.startModeD.on("pointerdown", () => setMode(this, "kingcast"));
  this.startModeE.on("pointerdown", () => setMode(this, "abyss"));
  this.startModeF.on("pointerdown", () => setMode(this, "boardTour"));
  [this.startModeA, this.startModeB, this.startModeC, this.startModeD, this.startModeE, this.startModeF].forEach((m) => m.setVisible(false).disableInteractive());
  this.startSound.on("pointerdown", () => toggleSound(this));
  this.startFullscreen.on("pointerdown", () => toggleFullscreen(this));
  drawUiIcons(this);
  setMode(this, "board");
  this.startHit.on("pointerdown", () => startGame(this));
  this.startButton.on("pointerdown", () => startGame(this));
  this.input.on("pointerdown", () => {
    if (this.board?.step === "intro" && this.board.introReady) {
      localStorage.setItem("pob_intro_seen", "1");
      this.board.step = "choose";
      renderBoard(this);
      return;
    }
    if (this.board?.step === "chosen") {
      if (!this.board.chosenReady && (this.board.chosenTimer || 0) > 0.4) {
        this.board.chosenTimer = 99;
        renderBoard(this);
        return;
      }
      if (this.board.chosenReady) {
        const p = this.input.activePointer;
        if (p.x >= 150 && p.x <= 390 && p.y >= 736 && p.y <= 826) {
          enterDungeonAfterGuardian(this);
          return;
        }
      }
    }
    if (!this.board?.tourOpen && this.board?.step === "exploreRun" && this.board.typewriter) {
      this.board.typewriter.chars = this.board.typewriter.full.length;
      renderBoard(this);
    }
  });
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
  setRunHudVisible(this, s.phase !== "start" && s.phase !== "board");
  if ((s.mode === "board" || s.mode === "boardTour") && s.phase === "board") return updateBoard(this, dt);
  if (s.mode === "kingcast" && s.phase === "walk") return updateKingMode(this, dt);
  drawCorridor(this);
  this.flash.setAlpha(Math.max(0, this.flash.alpha - dt * 4));

  if (s.phase === "walk") {
    startWalkSound(this);
    s.road += dt * 0.5;
    s.walkScroll += dt * 0.5;
    if (s.mode === "raycast" || s.mode === "kingcast") advanceRay(this, dt * 0.65);
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

const KING_DIRS = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];

function initKingMode(scene) {
  const dungeon = generateKingDungeon();
  scene.kingRun = {
    dungeon,
    progress: 0,
    target: dungeon.path.length - 2,
    camAngle: -Math.PI / 2,
    bobT: 0,
    camX: dungeon.path[0].x + 0.5,
    camY: dungeon.path[0].y + 0.5,
  };
}

function generateKingDungeon() {
  const size = 64;
  const grid = new Uint8Array(size * size).fill(1);
  const carve = (x, y) => { if (x > 1 && y > 1 && x < size - 2 && y < size - 2) grid[y * size + x] = 0; };
  const path = [];
  let x = Math.floor(size / 2), y = size - 4, dir = 0;
  carve(x, y); path.push({ x, y });
  for (let n = 0; n < 52; n++) {
    if (n > 8 && n % 13 === 0) dir = Math.random() < 0.5 ? 3 : 1;
    if (n > 8 && n % 13 === 4) dir = 0;
    const d = KING_DIRS[dir];
    x += d.x; y += d.y;
    carve(x, y); path.push({ x, y });
    if (n % 9 === 0) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) carve(x + dx, y + dy);
  }
  return { grid, size, path };
}

function kingIsWall(dungeon, x, y) {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= dungeon.size || y >= dungeon.size) return true;
  return dungeon.grid[y * dungeon.size + x] === 1;
}

function updateKingMode(scene, dt) {
  startWalkSound(scene);
  const run = scene.kingRun || (initKingMode(scene), scene.kingRun);
  run.progress = Math.min(run.target, run.progress + 2.35 * dt);
  run.bobT += dt * 9;
  const i = Math.max(0, Math.floor(run.progress));
  const f = run.progress - i;
  const a = run.dungeon.path[Math.min(i, run.dungeon.path.length - 1)];
  const b = run.dungeon.path[Math.min(i + 1, run.dungeon.path.length - 1)];
  run.camX = a.x + 0.5 + (b.x - a.x) * f;
  run.camY = a.y + 0.5 + (b.y - a.y) * f;
  const target = Math.atan2(b.y - a.y, b.x - a.x);
  let diff = target - run.camAngle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  run.camAngle += diff * Math.min(1, dt * 5);
  renderKingScene(scene, run);
  scene.hp.setText("KING-3D 독립 렌더 테스트");
  scene.floorText.setText(`${Math.min(i + 1, run.dungeon.path.length)}/${run.dungeon.path.length}`);
  scene.log.setText("pseudo-king 코드 구조 기반 자동 전진 중");
}

function kingFloorCeiling(ctx, w, h, cam, horizon, flick) {
  const img = ctx.createImageData(w, h), data = img.data;
  const lx = cam.dirX - cam.planeX, ly = cam.dirY - cam.planeY;
  const rx = cam.dirX + cam.planeX, ry = cam.dirY + cam.planeY;
  for (let y = 0; y < h; y++) {
    const isFloor = y > horizon;
    const p = Math.max(1, isFloor ? y - horizon : horizon - y);
    const rowDist = (0.5 * h) / p;
    const stepX = rowDist * (rx - lx) / w, stepY = rowDist * (ry - ly) / w;
    let fx = cam.x + rowDist * lx, fy = cam.y + rowDist * ly;
    const light = Math.min(1, 2.4 / (1 + rowDist * rowDist * 0.38)) * flick;
    for (let x = 0; x < w; x++) {
      const cx = Math.floor(fx), cy = Math.floor(fy), tx = fx - cx, ty = fy - cy;
      const j = rayHash(cx, cy, isFloor ? 3 : 7);
      let r, g, b;
      if (isFloor) {
        const tone = 0.72 + j * 0.5;
        r = 98 * tone; g = 84 * tone; b = 68 * tone;
        if (((cx + cy) & 1) === 0) { r *= 0.86; g *= 0.86; b *= 0.86; }
        if (tx < 0.07 || ty < 0.07) { r *= 0.42; g *= 0.42; b *= 0.42; }
      } else {
        const tone = 0.55 + j * 0.9;
        r = 36 * tone; g = 31 * tone; b = 40 * tone;
        if (j > 0.93) { r *= 1.6; g *= 1.5; b *= 1.3; }
      }
      const li = isFloor ? light : Math.min(1, light * 0.55 + 0.04);
      const idx = (y * w + x) * 4;
      data[idx] = r * li; data[idx + 1] = g * li; data[idx + 2] = b * li; data[idx + 3] = 255;
      fx += stepX; fy += stepY;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function renderKingScene(scene, run) {
  const tex = scene.floorCanvas, ctx = tex.context, w = W, h = H;
  ctx.clearRect(0, 0, w, h); ctx.imageSmoothingEnabled = false;
  const dirX = Math.cos(run.camAngle), dirY = Math.sin(run.camAngle), fov = 0.85;
  const cam = { x: run.camX, y: run.camY, dirX, dirY, planeX: -dirY * fov, planeY: dirX * fov };
  const horizon = Math.round(h / 2 + Math.sin(run.bobT) * h * 0.012);
  const flick = 1 + 0.07 * Math.sin(scene.state.timer * 9.3) + 0.05 * Math.sin(scene.state.timer * 23.7 + 1.3);
  kingFloorCeiling(ctx, w, h, cam, horizon, flick);
  for (let x = 0; x < w; x++) {
    const cameraX = 2 * x / w - 1;
    const rayDirX = cam.dirX + cam.planeX * cameraX, rayDirY = cam.dirY + cam.planeY * cameraX;
    let mapX = Math.floor(cam.x), mapY = Math.floor(cam.y);
    const deltaX = Math.abs(1 / (rayDirX || 1e-6)), deltaY = Math.abs(1 / (rayDirY || 1e-6));
    let stepX, stepY, sideDistX, sideDistY;
    if (rayDirX < 0) { stepX = -1; sideDistX = (cam.x - mapX) * deltaX; } else { stepX = 1; sideDistX = (mapX + 1 - cam.x) * deltaX; }
    if (rayDirY < 0) { stepY = -1; sideDistY = (cam.y - mapY) * deltaY; } else { stepY = 1; sideDistY = (mapY + 1 - cam.y) * deltaY; }
    let side = 0, guard = 0;
    while (!kingIsWall(run.dungeon, mapX, mapY) && guard++ < 128) {
      if (sideDistX < sideDistY) { sideDistX += deltaX; mapX += stepX; side = 0; }
      else { sideDistY += deltaY; mapY += stepY; side = 1; }
    }
    const perp = side === 0 ? (mapX - cam.x + (1 - stepX) / 2) / (rayDirX || 1e-6) : (mapY - cam.y + (1 - stepY) / 2) / (rayDirY || 1e-6);
    const dist = Math.max(0.05, perp), lineH = h / dist;
    const y0 = Math.max(0, -lineH / 2 + horizon), y1 = Math.min(h, lineH / 2 + horizon);
    let wallX = side === 0 ? cam.y + perp * rayDirY : cam.x + perp * rayDirX; wallX -= Math.floor(wallX);
    const light = (1.5 / (1 + dist * 0.55)) * flick, fog = 1 / (1 + dist * dist * 0.05);
    const base = side === 1 ? [104, 84, 66] : [148, 122, 94];
    const cellJitter = 0.88 + rayHash(mapX, mapY, 11) * 0.24;
    const mossy = rayHash(mapX, mapY, 53) > 0.6;
    const segH = (y1 - y0) / 4;
    for (let row = 0; row < 4; row++) {
      const yy0 = y0 + segH * row, yy1 = row === 3 ? y1 : y0 + segH * (row + 1);
      const bu = wallX * 2 + (row % 2 === 0 ? 0 : 0.5), brickIdx = Math.floor(bu), bf = bu - brickIdx;
      let tint = base, k = light * fog * cellJitter * (0.8 + rayHash(mapX * 3 + brickIdx, mapY * 5 + row, 29) * 0.4);
      if (row === 3 && mossy) { tint = [base[0] * 0.62, base[1] * 0.82, base[2] * 0.55]; k *= 0.85; }
      if (bf < 0.09) k *= 0.42;
      ctx.fillStyle = rayShade(tint, k); ctx.fillRect(x, yy0, 1, yy1 - yy0);
      if (row > 0) { ctx.fillStyle = rayShade(base, light * fog * 0.3); ctx.fillRect(x, yy0 - 0.5, 1, 1); }
    }
  }
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.15, w / 2, h / 2, h * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, `rgba(0,0,0,${(0.74 - (flick - 1) * 0.6).toFixed(3)})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  tex.refresh(); scene.corridor.clear();
  for (const prop of scene.props) prop.sprite.setVisible(false);
  scene.enemy.setVisible(false); scene.enemyHpBg.setVisible(false); scene.enemyHpLagBar.setVisible(false); scene.enemyHpBar.setVisible(false);
}


function clearDemoData(scene) {
  try {
    ["pob_demo", "pob_state", "pob_save", "pob_board", "pob_intro_seen", "pob_guardian_chosen"].forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
  } catch (_) {}
  scene.sound?.stopAll();
  window.location.reload();
}

function showStartResetConfirm(scene) {
  scene.resetConfirm?.destroy(true);
  const c = scene.add.container(0, 0).setDepth(90);
  addRect(scene, c, 0, 0, W, H, 0x000000, 0.62, null, 90);
  addRect(scene, c, 48, 312, 444, 250, UI_THEME.panel, 1, UI_THEME.borderHot, 91);
  addText(scene, c, 78, 344, "데모 초기화", 24, UI_THEME.gold, 92);
  addText(scene, c, 78, 394, "데이터를 초기상태로 돌립니다.", 16, UI_THEME.ink, 92);
  addText(scene, c, 78, 424, "현재 진행 내용이 사라집니다. 계속할까요?", 15, UI_THEME.muted, 92);
  addButton(scene, c, 84, 494, 156, 52, "취소", () => {
    scene.resetConfirm?.destroy(true);
    scene.resetConfirm = null;
  }, "default", 92);
  addButton(scene, c, 300, 494, 156, 52, "확인", () => clearDemoData(scene), "danger", 92);
  scene.resetConfirm = c;
}

function setRunHudVisible(scene, visible) {
  scene.title?.setVisible(visible);
  scene.hp?.setVisible(visible);
  scene.floorText?.setVisible(visible);
  scene.log?.setVisible(visible);
  scene.hpBarBg?.setVisible(visible);
  scene.hpLagBar?.setVisible(visible);
  scene.hpBar?.setVisible(visible);
}

function startWalkSound(scene) {
  if (!scene.sfx.bgm.isPlaying) safePlay(scene.sfx.bgm);
  if (!scene.sfx.walk.isPlaying) safePlay(scene.sfx.walk);
}

function startGame(scene) {
  requestMobileFullscreen(scene);
  scene.startButton.setText("시작하기");
  scene.startHit.setAlpha(0.92);
  if (scene.state.mode === "board") return startBoardMode(scene, false);
  if (scene.state.mode === "boardTour") return startBoardMode(scene, true);
  if (scene.state.mode === "abyss") { window.location.href = "mode5_dungeon.html"; return; }
  if (scene.state.mode === "kingcast") initKingMode(scene);
  scene.state.phase = "walk";
  setRunHudVisible(scene, true);
  scene.startPanel.setVisible(false);
  scene.startDecor?.forEach((o) => o.setVisible(false));
  scene.startText.setVisible(false);
  scene.startModeA.setVisible(false).disableInteractive();
  scene.startModeB.setVisible(false).disableInteractive();
  scene.startModeC.setVisible(false).disableInteractive();
  scene.startModeD.setVisible(false).disableInteractive();
  scene.startModeE.setVisible(false).disableInteractive();
  scene.startModeF.setVisible(false).disableInteractive();
  scene.startSound.setVisible(false).disableInteractive();
  scene.startFullscreen.setVisible(false).disableInteractive();
  scene.startButton.setVisible(false).disableInteractive();
  scene.startHit.setVisible(false).disableInteractive();
  scene.startRexButton?.setVisible(false).disableInteractive();
  scene.resetHit?.setVisible(false).disableInteractive();
  scene.resetText?.setVisible(false).disableInteractive();
  scene.resetConfirm?.destroy(true);
  scene.resetConfirm = null;
  startWalkSound(scene);
}

function setMode(scene, mode) {
  scene.state.mode = mode;
  scene.startModeA.setColor(mode === "scroll" ? "#f0b24b" : "#f4f1e8");
  scene.startModeB.setColor(mode === "raycast" ? "#f0b24b" : "#f4f1e8");
  scene.startModeC.setColor(mode === "board" ? "#f0b24b" : "#f4f1e8");
  scene.startModeD.setColor(mode === "kingcast" ? "#f0b24b" : "#f4f1e8");
  scene.startModeE.setColor(mode === "abyss" ? "#f0b24b" : "#f4f1e8");
  scene.startModeF.setColor(mode === "boardTour" ? "#f0b24b" : "#f4f1e8");
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

function requestMobileFullscreen(scene) {
  if (!matchMedia("(pointer:coarse)").matches || document.fullscreenElement) return;
  const el = scene.game.canvas.parentElement || scene.game.canvas;
  el.requestFullscreen?.().catch?.(() => {});
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

function rayHash(x, y, salt) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(salt | 0, 224682251);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function rayShade(rgb, k) {
  k = Phaser.Math.Clamp(k, 0.06, 1);
  return `rgb(${Math.round(rgb[0] * k)},${Math.round(rgb[1] * k)},${Math.round(rgb[2] * k)})`;
}

function rayIsWall(x, y) {
  return RAY_MAP[Math.floor(y)]?.[Math.floor(x)] !== "0";
}

function advanceRay(scene, step) {
  const s = scene.state;
  const nx = s.rayX + Math.cos(s.rayDir) * step;
  const ny = s.rayY + Math.sin(s.rayDir) * step;
  if (!rayIsWall(nx, ny)) { s.rayX = nx; s.rayY = ny; return; }
  s.rayDir += Math.PI / 2;
}

function drawRayFloorCeiling(ctx, w, h, cam, horizon, flick) {
  const img = ctx.createImageData(w, h);
  const data = img.data;
  const leftX = cam.dirX - cam.planeX, leftY = cam.dirY - cam.planeY;
  const rightX = cam.dirX + cam.planeX, rightY = cam.dirY + cam.planeY;
  for (let y = 0; y < h; y++) {
    const floorSide = y > horizon;
    const p = Math.max(1, floorSide ? y - horizon : horizon - y);
    const rowDist = (0.5 * h) / p;
    const stepX = rowDist * (rightX - leftX) / w;
    const stepY = rowDist * (rightY - leftY) / w;
    let fx = cam.x + rowDist * leftX;
    let fy = cam.y + rowDist * leftY;
    const light = Math.min(1, 2.2 / (1 + rowDist * rowDist * 0.42)) * flick;
    for (let x = 0; x < w; x++) {
      const cx = Math.floor(fx), cy = Math.floor(fy);
      const tx = fx - cx, ty = fy - cy;
      const j = rayHash(cx, cy, floorSide ? 3 : 7);
      let r, g, b;
      if (floorSide) {
        const tone = 0.72 + j * 0.48;
        r = 86 * tone; g = 78 * tone; b = 66 * tone;
        if (((cx + cy) & 1) === 0) { r *= 0.86; g *= 0.86; b *= 0.86; }
        if (tx < 0.08 || ty < 0.08) { r *= 0.38; g *= 0.38; b *= 0.38; }
      } else {
        const tone = 0.5 + j * 0.8;
        r = 32 * tone; g = 30 * tone; b = 36 * tone;
        if (j > 0.94) { r *= 1.45; g *= 1.35; b *= 1.25; }
      }
      const li = floorSide ? light : Math.min(1, light * 0.5 + 0.04);
      const idx = (y * w + x) * 4;
      data[idx] = r * li; data[idx + 1] = g * li; data[idx + 2] = b * li; data[idx + 3] = 255;
      fx += stepX; fy += stepY;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function drawRaycastView(scene) {
  const tex = scene.floorCanvas;
  const ctx = tex.context;
  const w = W, h = H;
  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = false;

  const dirX = Math.cos(scene.state.rayDir);
  const dirY = Math.sin(scene.state.rayDir);
  const fov = 0.72;
  const cam = { x: scene.state.rayX, y: scene.state.rayY, dirX, dirY, planeX: -dirY * fov, planeY: dirX * fov };
  const horizon = Math.round(h * 0.5 + Math.sin(scene.state.timer * 8) * 5);
  const flick = 1 + 0.06 * Math.sin(scene.state.timer * 9.3) + 0.04 * Math.sin(scene.state.timer * 22.7);
  drawRayFloorCeiling(ctx, w, h, cam, horizon, flick);

  for (let x = 0; x < w; x += 2) {
    const cameraX = 2 * x / w - 1;
    const rayDirX = cam.dirX + cam.planeX * cameraX;
    const rayDirY = cam.dirY + cam.planeY * cameraX;
    let mapX = Math.floor(cam.x), mapY = Math.floor(cam.y);
    const deltaX = Math.abs(1 / (rayDirX || 1e-6));
    const deltaY = Math.abs(1 / (rayDirY || 1e-6));
    let stepX, stepY, sideDistX, sideDistY;
    if (rayDirX < 0) { stepX = -1; sideDistX = (cam.x - mapX) * deltaX; } else { stepX = 1; sideDistX = (mapX + 1 - cam.x) * deltaX; }
    if (rayDirY < 0) { stepY = -1; sideDistY = (cam.y - mapY) * deltaY; } else { stepY = 1; sideDistY = (mapY + 1 - cam.y) * deltaY; }
    let side = 0, guard = 0;
    while (!rayIsWall(mapX, mapY) && guard++ < 64) {
      if (sideDistX < sideDistY) { sideDistX += deltaX; mapX += stepX; side = 0; }
      else { sideDistY += deltaY; mapY += stepY; side = 1; }
    }
    const perp = side === 0 ? (mapX - cam.x + (1 - stepX) / 2) / (rayDirX || 1e-6) : (mapY - cam.y + (1 - stepY) / 2) / (rayDirY || 1e-6);
    const dist = Math.max(0.05, perp);
    const wallH = h / dist;
    const y0 = Math.max(0, horizon - wallH / 2);
    const y1 = Math.min(h, horizon + wallH / 2);
    let wallX = side === 0 ? cam.y + perp * rayDirY : cam.x + perp * rayDirX;
    wallX -= Math.floor(wallX);
    const light = (1.45 / (1 + dist * 0.55)) * flick;
    const fog = 1 / (1 + dist * dist * 0.055);
    const base = side === 1 ? [92, 78, 68] : [128, 108, 88];
    const moss = rayHash(mapX, mapY, 53) > 0.62;
    const rows = 4;
    const segH = (y1 - y0) / rows;
    for (let r = 0; r < rows; r++) {
      const sy0 = y0 + segH * r;
      const sy1 = r === rows - 1 ? y1 : y0 + segH * (r + 1);
      const bu = wallX * 2 + (r % 2 ? 0.5 : 0);
      const bf = bu - Math.floor(bu);
      const joint = bf < 0.09;
      const bj = 0.78 + rayHash(mapX * 3 + Math.floor(bu), mapY * 5 + r, 29) * 0.38;
      let tint = base;
      let k = light * fog * bj;
      if (r === rows - 1 && moss) { tint = [base[0] * 0.58, base[1] * 0.82, base[2] * 0.55]; k *= 0.85; }
      if (joint) k *= 0.38;
      ctx.fillStyle = rayShade(tint, k);
      ctx.fillRect(x, sy0, 2, Math.max(1, sy1 - sy0));
      if (r > 0) { ctx.fillStyle = rayShade(base, light * fog * 0.26); ctx.fillRect(x, sy0 - 1, 2, 1); }
    }
    const ao = Math.min(0.5, 0.3 * fog + 0.12);
    ctx.fillStyle = `rgba(0,0,0,${ao.toFixed(3)})`;
    ctx.fillRect(x, y0, 2, Math.max(1, segH * 0.12));
    ctx.fillRect(x, y1 - Math.max(1, segH * 0.18), 2, Math.max(1, segH * 0.18));
  }

  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.14, w / 2, h / 2, h * 0.74);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.74)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  tex.refresh();
  scene.corridor.clear();
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


function codexData() {
  return window.PixelCodex?.DATA || { monsters: [], jobs: [], dungeons: [], ELC: {}, CATC: {} };
}

function gradeFromStars(stars) {
  if (stars >= 5) return "S";
  if (stars >= 4) return "A";
  if (stars >= 3) return "B";
  return "C";
}

function makeBossState(mon, recruited = false) {
  return {
    id: `codex-${mon.id}`,
    codexId: mon.id,
    name: mon.n,
    lv: recruited ? 3 : mon.lv,
    exp: recruited ? 25 : 0,
    nextExp: 100,
    ap: recruited ? 3 : 0,
    maxAp: 3,
    hp: recruited ? Math.max(80, mon.hp) : mon.hp,
    maxHp: recruited ? Math.max(80, mon.hp) : mon.hp,
    atk: recruited ? Math.max(18, mon.at) : mon.at,
    def: recruited ? Math.max(6, mon.df) : mon.df,
    spd: recruited ? Math.max(8, mon.sd) : mon.sd,
    grade: gradeFromStars(mon.r),
    interest: recruited ? 3 : 0,
    need: 3,
    cost: Math.max(80, mon.lv * 12),
    trait: mon.t,
    status: recruited ? "대기" : "미영입",
    recruited,
    discovered: true,
  };
}

function makeBoardBosses() {
  const monsters = codexData().monsters;
  const bosses = monsters.filter((m) => m.dep === "BOSS");
  const slime = monsters.find((m) => m.sp === "slime") || { id: 1, n: "슬라임", lv: 1, hp: 80, at: 18, df: 6, sd: 8, r: 1, t: "초기 필드보스" };
  const list = [slime, ...bosses.filter((m) => m.id !== slime.id)];
  return list.map((m) => makeBossState(m, false));
}


function ensureInitialGuardian(scene) {
  const slime = scene.board?.bosses?.find((b) => /슬라임|slime/i.test(`${b.name} ${b.id}`)) || scene.board?.bosses?.[0];
  if (!slime) return;
  slime.recruited = true;
  slime.status = slime.status === "순찰" ? "순찰" : "대기";
  slime.lv = Math.max(1, slime.lv || 1);
  slime.exp = slime.exp || 0;
  slime.ap = Math.max(1, slime.ap || slime.maxAp || 3);
  slime.maxHp = slime.maxHp || 80;
  slime.hp = Phaser.Math.Clamp(slime.hp || slime.maxHp, 1, slime.maxHp);
  scene.board.selectedBoss = slime.id;
  scene.board.dungeon.bosses = Math.max(1, scene.board.dungeon.bosses || 0);
  scene.board.ownedMonsterIds?.add?.(slime.codexId || slime.id);
  scene.board.discoveredCodex?.add?.(slime.codexId || slime.id);
}

function enterDungeonAfterGuardian(scene) {
  localStorage.setItem("pob_guardian_chosen", "1");
  ensureInitialGuardian(scene);
  scene.board.step = "main";
  renderBoard(scene);
}

function recruitInitialBoss(scene, boss) {
  const slime = scene.board.bosses.find((b) => /슬라임|slime/i.test(`${b.name} ${b.id}`)) || scene.board.bosses[0];
  scene.board.bosses.forEach((b) => { b.recruited = false; b.status = "미영입"; b.ap = 0; });
  slime.recruited = true;
  slime.status = "대기";
  slime.lv = Math.max(1, slime.lv || 1);
  slime.exp = 0;
  slime.ap = slime.maxAp || 3;
  slime.hp = slime.maxHp;
  scene.board.selectedBoss = slime.id;
  scene.board.chosenName = boss.name;
  scene.board.dungeon.bosses = 1;
  scene.board.logs.unshift(`${boss.name} 소환 의식 결과, 슬라임이 입주했다.`);
  scene.board.step = "chosen";
  scene.board.chosenTimer = 0;
  scene.board.chosenReady = false;
  renderBoard(scene);
}

function makeBoardAreas() {
  return codexData().dungeons.map((d, i) => ({
    name: d.name,
    desc: d.desc,
    diff: d.rec,
    req: i === 0 ? 0 : i === 1 ? 42 : i * 70,
    unlockCost: i === 0 ? 0 : i === 1 ? 80 : 120 + i * 60,
    unlocked: i === 0,
    progress: 0,
    max: 4,
    done: false,
    dungeonNo: d.no,
    hue: d.hue,
  }));
}

function ensureDustTexture(scene, frame) {
  const key = `dust-${frame}`;
  if (scene.textures.exists(key)) return key;
  const cv = document.createElement("canvas");
  cv.width = 32; cv.height = 32;
  const g = cv.getContext("2d");
  g.imageSmoothingEnabled = false;
  const dots = [
    [[10,18,6,4],[17,17,8,5],[22,20,5,3],[15,22,10,4]],
    [[7,17,7,4],[15,15,10,6],[24,18,6,4],[11,23,8,3]],
    [[5,18,5,3],[13,14,8,5],[21,15,9,5],[25,22,4,3]],
    [[8,20,4,2],[15,16,6,3],[23,18,5,3],[18,23,8,2]],
  ][frame & 3];
  dots.forEach((d, i) => {
    g.fillStyle = i % 2 ? "#8f8272" : "#c8bca8";
    g.beginPath();
    g.ellipse(d[0], d[1], d[2], d[3], 0, 0, Math.PI * 2);
    g.fill();
  });
  g.fillStyle = frame % 2 ? "#ffd24f" : "#ffffff";
  g.fillRect(22, 10, 2, 2);
  g.fillRect(8, 12, 2, 2);
  scene.textures.addCanvas(key, cv);
  return key;
}

function spawnDungeonDust(scene, x, y, a = null, b = null) {
  const fx = { x, y, t: 0, frame: 0, a, b, resolved: false, actor: null };
  if (scene.boardUi) {
    fx.actor = scene.add.image(x, y, ensureDustTexture(scene, 0)).setDepth(64).setScale(2.0).setAlpha(scene.board.helpTab ? 0 : 0.95);
    scene.boardUi.add(fx.actor);
  }
  scene.board.dustEffects.push(fx);
}

function resolveDungeonDust(scene, fx) {
  if (fx.resolved) return;
  fx.resolved = true;
  const dwellers = scene.board.dwellers || [];
  if (!dwellers.includes(fx.a) || !dwellers.includes(fx.b)) return;
  let loser;
  if (fx.a.kind === "boss" && fx.b.kind === "hero") loser = fx.b;
  else if (fx.b.kind === "boss" && fx.a.kind === "hero") loser = fx.a;
  else loser = Math.random() < 0.62 ? (fx.a.kind === "hero" ? fx.a : fx.b) : (fx.a.kind === "hero" ? fx.b : fx.a);
  loser.actor?.destroy();
  loser.badge?.destroy();
  scene.board.dwellers = dwellers.filter((m) => m !== loser);
  const winner = loser === fx.a ? fx.b : fx.a;
  winner.pause = 0;
  winner.fighting = false;
  winner.bumpCd = 1.2;
  resetDungeonDwellerVelocity(winner);
  refillDungeonDwellers(scene, Math.max(6, Math.min(18, scene.board.dungeon.households)));
  scene.board.needsDungeonRender = scene.board.tab === "dungeon" && scene.board.step === "main";
}

function isDungeonHostile(a, b) {
  const aHero = a.kind === "hero";
  const bHero = b.kind === "hero";
  return aHero !== bHero;
}

function resetDungeonDwellerVelocity(m) {
  const speedX = 10 + Math.random() * 14;
  const speedY = 6 + Math.random() * 10;
  m.dx = m.kind === "hero" ? -speedX : speedX;
  m.dy = (Math.random() < 0.5 ? -1 : 1) * speedY;
}

function randomPick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function pushDungeonFeed(scene, line) {
  if (!scene.board) return;
  const feed = scene.board.dungeonFeed || (scene.board.dungeonFeed = []);
  if (feed[0] === line) return;
  feed.unshift(line);
  feed.length = Math.min(feed.length, 3);
}

function updateDungeonFeed(scene, dt) {
  const board = scene.board;
  if (!board || board.step !== "main" || board.tab !== "dungeon") return;
  board.dungeonLogTimer = (board.dungeonLogTimer || 0) - dt;
  if (board.dungeonLogTimer > 0) return;
  board.dungeonLogTimer = 2.8 + Math.random() * 1.8;
  const dwellers = board.dwellers || [];
  const monsters = dwellers.filter((m) => m.kind === "monster").length;
  const heroes = dwellers.length - monsters;
  const lines = [
    "축축한 바닥 위로 작은 발자국이 번진다.",
    "슬라임이 벽 틈의 Soul 냄새를 맡는다.",
    "박쥐가 어두운 천장 근처를 맴돈다.",
    "외눈박이가 침입자의 방향을 흘겨본다.",
    `던전 안에 몬스터 ${monsters}체와 침입자 ${heroes}명이 움직인다.`,
    "떠돌이 몬스터가 빈 구석을 자기 자리처럼 차지했다.",
  ];
  pushDungeonFeed(scene, randomPick(lines));
}

function ownedDungeonMonsters(scene) {
  const data = codexData();
  const owned = scene?.board?.ownedMonsterIds || new Set([1, 108]);
  let pool = data.monsters.filter((m) => owned.has(m.id) && m.dep !== "BOSS");
  if (!pool.length) pool = data.monsters.filter((m) => m.sp === "slime" || m.id === 1 || m.id === 108);
  return pool;
}

function recruitedDungeonBosses(scene) {
  const bosses = scene?.board?.bosses?.filter((b) => b.recruited) || [];
  return bosses.length ? bosses : [{ codexId: 1, name: "슬라임" }];
}

function makeDungeonDweller(kind = "monster", edge = false, scene = null) {
  const data = codexData();
  const monsters = ownedDungeonMonsters(scene);
  const bosses = recruitedDungeonBosses(scene);
  const heroes = data.jobs;
  const hero = kind === "hero";
  const boss = kind === "boss";
  const pool = hero ? heroes : boss ? bosses : monsters;
  const ent = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  const b = DUNGEON_ACTOR_BOUNDS;
  const speedX = 10 + Math.random() * 14;
  return {
    id: ent?.codexId || ent?.id || (hero ? 101 : 1),
    kind: hero ? "hero" : boss ? "boss" : "monster",
    x: edge ? (hero ? b.x2 : b.x1) : b.x1 + Math.random() * (b.x2 - b.x1),
    y: b.y1 + Math.random() * (b.y2 - b.y1),
    dx: edge ? (hero ? -speedX : speedX) : (Math.random() < 0.5 ? -1 : 1) * speedX,
    dy: (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 10),
    r: boss ? 24 : hero ? 18 : 16,
    pause: 0,
    bumpCd: 0,
    frame: Math.floor(Math.random() * 4),
    frameT: Math.random() * 0.2,
  };
}

function makeDungeonDwellers(count = 12, scene = null) {
  const list = [makeDungeonDweller("boss", false, scene)];
  while (list.length < count) list.push(makeDungeonDweller(list.length % 2 ? "hero" : "monster", false, scene));
  return list;
}

function normalizeDungeonBoss(scene) {
  const list = scene.board.dwellers || (scene.board.dwellers = []);
  const bosses = list.filter((m) => m.kind === "boss");
  if (!bosses.length) {
    list.unshift(makeDungeonDweller("boss", false, scene));
    return;
  }
  const keep = bosses[0];
  scene.board.dwellers = list.filter((m) => {
    if (m.kind !== "boss" || m === keep) return true;
    m.actor?.destroy();
    m.badge?.destroy();
    return false;
  });
}

function refillDungeonDwellers(scene, targetCount) {
  normalizeDungeonBoss(scene);
  const list = scene.board.dwellers;
  while (list.length < targetCount) {
    const heroes = list.filter((m) => m.kind === "hero").length;
    const monsters = list.filter((m) => m.kind === "monster").length;
    list.push(makeDungeonDweller(heroes < monsters ? "hero" : "monster", true, scene));
  }
}

function codexById(id) {
  return window.PixelCodex?.getEntity?.(id) || null;
}

function ensureCodexTexture(scene, id, frame = 0) {
  const key = `codex-${id}-${frame}`;
  if (scene.textures.exists(key)) return key;
  const frames = window.PixelCodex?.getFrames?.(id);
  if (!frames?.[frame]) return null;
  scene.textures.addCanvas(key, frames[frame]);
  return key;
}

function addCodexSprite(scene, c, id, x, y, scale = 2, opts = {}) {
  const alpha = typeof opts === "number" ? opts : opts.alpha ?? 1;
  const hidden = typeof opts === "object" && opts.hidden;
  const key = ensureCodexTexture(scene, id, 0);
  if (!key) return addBoardSlime(scene, c, x, y, scale);
  const img = scene.add.image(x, y, key).setDepth(62).setScale(scale).setAlpha(alpha);
  if (hidden) img.setTint(0x000000).setAlpha(0.82);
  c.add(img);
  if (!hidden && window.PixelCodex?.getFrames?.(id)?.length > 1) {
    let frame = 0;
    const ev = scene.time.addEvent({ delay: 160, loop: true, callback: () => {
      if (!img.active) return;
      frame = (frame + 1) & 3;
      const next = ensureCodexTexture(scene, id, frame);
      if (next) img.setTexture(next);
    }});
    img.once("destroy", () => ev.remove(false));
  }
  return img;
}

function isCodexDiscovered(scene, id) {
  return scene.board?.dexAllDiscovered === true || scene.board?.discoveredCodex?.has?.(id);
}

function codexPoolForArea(area, kind) {
  const data = codexData();
  if (kind === "hero") return data.jobs;
  const pool = data.monsters.filter((m) => m.d === area.dungeonNo);
  if (kind === "boss") return pool.filter((m) => m.dep === "BOSS");
  return pool.filter((m) => m.dep !== "BOSS");
}

function startBoardMode(scene, tourVisual = false) {
  window.__pobScene = scene;
  scene.state.phase = "board";
  if (scene.state.soundOn && !scene.sfx.bgm.isPlaying) safePlay(scene.sfx.bgm);
  setRunHudVisible(scene, false);
  scene.startPanel.setVisible(false);
  scene.startDecor?.forEach((o) => o.setVisible(false));
  scene.startText.setVisible(false);
  scene.startModeA.setVisible(false).disableInteractive();
  scene.startModeB.setVisible(false).disableInteractive();
  scene.startModeC.setVisible(false).disableInteractive();
  scene.startModeD.setVisible(false).disableInteractive();
  scene.startModeE.setVisible(false).disableInteractive();
  scene.startModeF.setVisible(false).disableInteractive();
  scene.startSound.setVisible(false).disableInteractive();
  scene.startFullscreen.setVisible(false).disableInteractive();
  scene.startButton.setVisible(false).disableInteractive();
  scene.startHit.setVisible(false).disableInteractive();
  scene.startRexButton?.setVisible(false).disableInteractive();
  scene.resetHit?.setVisible(false).disableInteractive();
  scene.resetText?.setVisible(false).disableInteractive();
  scene.resetConfirm?.destroy(true);
  scene.resetConfirm = null;
  scene.enemy.setVisible(false);
  scene.enemyHpBg.setVisible(false);
  scene.enemyHpLagBar.setVisible(false);
  scene.enemyHpBar.setVisible(false);
  const introSeen = localStorage.getItem("pob_intro_seen") === "1";
  const guardianChosen = localStorage.getItem("pob_guardian_chosen") === "1";
  scene.board = {
    step: guardianChosen ? "main" : introSeen ? "choose" : "intro",
    tab: "dungeon",
    selectedBoss: "slime",
    chosenName: "",
    introTimer: 0,
    chosenTimer: 0,
    chosenReady: false,
    dexDungeon: 1,
    dexView: "monster",
    dungeon: { name: "축축한 동굴", area: 18, floor: "B1F", households: 12, capacity: 20, bosses: 1, asset: 1250, notoriety: 42, soul: 320, gem: 125, stage: 0 },
    bosses: makeBoardBosses(),
    areas: (window.__lastBoardAreas = makeBoardAreas()),
    logs: ["던전 지배권을 확보했다.", "축축한 동굴 18평에서 시작한다."],
    battle: null,
    invasion: false,
    powerUsed: false,
    ownedMonsterIds: new Set([1, 108]),
    discoveredCodex: new Set([1, 108]),
    dexAllDiscovered: false,
    dwellers: makeDungeonDwellers(12),
    dungeonActors: [],
    dustEffects: [],
    dungeonLogTimer: 0,
    dungeonFeed: ["슬라임이 바닥 틈의 Soul 냄새를 맡는다."],
    exploreRun: null,
    typewriter: null,
    battleFx: { popups: [], particles: [], slash: 0 },
    apTimer: 0,
    tourVisual,
  };
  if (guardianChosen) ensureInitialGuardian(scene);
  renderBoard(scene);
}

function updateBoard(scene, dt) {
  scene.flash.setAlpha(Math.max(0, scene.flash.alpha - dt * 4));
  if (!scene.board) return;
  if (scene.board.step === "intro") {
    scene.board.introTimer = (scene.board.introTimer || 0) + dt;
    renderBoard(scene);
    return;
  }
  if (scene.board.step === "chosen") {
    scene.board.chosenTimer = (scene.board.chosenTimer || 0) + dt;
    renderBoard(scene);
    return;
  }
  updateDungeonFeed(scene, dt);
  const dwellers = scene.board.dwellers || [];
  for (const m of dwellers) {
    m.pause = Math.max(0, (m.pause || 0) - dt);
    m.bumpCd = Math.max(0, (m.bumpCd || 0) - dt);
    if (!m.pause && !m.fighting) { m.x += m.dx * dt; m.y += m.dy * dt; }
    const bnd = DUNGEON_ACTOR_BOUNDS;
    if (m.x < bnd.x1 || m.x > bnd.x2) m.dx *= -1;
    if (m.y < bnd.y1 || m.y > bnd.y2) m.dy *= -1;
    m.x = Phaser.Math.Clamp(m.x, bnd.x1, bnd.x2);
    m.y = Phaser.Math.Clamp(m.y, bnd.y1, bnd.y2);
    m.frameT = (m.frameT || 0) + dt;
    if (m.frameT >= 0.16) { m.frameT = 0; m.frame = ((m.frame || 0) + 1) & 3; }
  }
  for (let i = 0; i < dwellers.length; i++) {
    for (let j = i + 1; j < dwellers.length; j++) {
      const a = dwellers[i], b = dwellers[j];
      const min = (a.r || 16) + (b.r || 16);
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.001;
      if (d >= min) continue;
      const push = (min - d) * 0.5;
      const nx = dx / d, ny = dy / d;
      const hostile = isDungeonHostile(a, b);
      if (hostile && !a.bumpCd && !b.bumpCd && !a.fighting && !b.fighting && scene.board.tab === "dungeon" && scene.board.step === "main") {
        spawnDungeonDust(scene, (a.x + b.x) / 2, (a.y + b.y) / 2, a, b);
        pushDungeonFeed(scene, randomPick([
          "침입자와 몬스터가 맞붙었다. 먼지가 피어오른다.",
          "던전 한복판에서 짧은 난투가 벌어졌다.",
          "용사의 발소리에 몬스터가 달려들었다.",
        ]));
        a.pause = b.pause = 4.0;
        a.fighting = b.fighting = true;
        a.bumpCd = b.bumpCd = 4.4;
      }
      const bnd = DUNGEON_ACTOR_BOUNDS;
      a.x = Phaser.Math.Clamp(a.x - nx * push, bnd.x1, bnd.x2);
      a.y = Phaser.Math.Clamp(a.y - ny * push, bnd.y1, bnd.y2);
      b.x = Phaser.Math.Clamp(b.x + nx * push, bnd.x1, bnd.x2);
      b.y = Phaser.Math.Clamp(b.y + ny * push, bnd.y1, bnd.y2);
      a.dx = -Math.sign(nx || a.dx || 1) * Math.max(8, Math.abs(a.dx)); a.dy -= ny * 3;
      b.dx = Math.sign(nx || b.dx || 1) * Math.max(8, Math.abs(b.dx)); b.dy += ny * 3;
    }
  }
  for (const m of dwellers) {
    if (m.actor?.active) {
      m.actor.setPosition(m.x, m.y).setDepth(63 + m.y / 1000).setFlipX(m.dx < 0);
      m.badge?.setPosition(m.x + 16, m.y - 25).setDepth(67 + m.y / 1000);
      const key = ensureCodexTexture(scene, m.id, m.frame || 0);
      if (key) m.actor.setTexture(key);
    }
  }
  if (scene.board.tab === "dungeon" && scene.board.step === "main") refillDungeonDwellers(scene, Math.max(6, Math.min(18, scene.board.dungeon.households)));

  for (let i = (scene.board.dustEffects || []).length - 1; i >= 0; i -= 1) {
    const fx = scene.board.dustEffects[i];
    fx.t += dt;
    const frame = Math.floor(fx.t / 0.13) & 3;
    if (fx.actor?.active) {
      fx.x = ((fx.a?.x || fx.x) + (fx.b?.x || fx.x)) / 2;
      fx.y = ((fx.a?.y || fx.y) + (fx.b?.y || fx.y)) / 2;
      fx.actor.setPosition(fx.x, fx.y).setTexture(ensureDustTexture(scene, frame));
      fx.actor.setAlpha(scene.board.helpTab ? 0 : (fx.t > 3.65 ? Math.max(0, 1 - (fx.t - 3.65) / 0.35) : 0.95));
      fx.actor.setScale(2.1 + 0.25 * Math.sin(fx.t * 12));
    }
    if (fx.t >= 4.0) resolveDungeonDust(scene, fx);
    if (fx.t >= 4.25) {
      fx.actor?.destroy();
      scene.board.dustEffects.splice(i, 1);
    }
  }
  if (scene.board.needsDungeonRender) {
    scene.board.needsDungeonRender = false;
    renderBoard(scene);
    return;
  }
  scene.board.apTimer += dt;
  if (scene.board.apTimer >= 10) {
    scene.board.apTimer = 0;
    scene.board.bosses.filter((b) => b.recruited).forEach((b) => { b.ap = Math.min(b.maxAp || 3, (b.ap || 0) + 1); });
    if (scene.board.tab === "boss" || scene.board.tab === "explore") renderBoard(scene);
  }
  if (scene.board.step === "exploreRun") {
    const tw = scene.board.typewriter;
    if (tw) tw.chars = Math.min(tw.full.length, (tw.chars || 0) + dt * 40);
    const run = scene.board.exploreRun;
    run.timer += dt;
    if (!run.finished && run.timer >= 0.95) {
      run.timer = 0;
      advancePatrolLine(scene);
      renderBoard(scene);
    }
    return;
  }
  if (scene.board.step !== "battle") return;
  updateBattleFx(scene, dt);
  const b = scene.board.battle;
  const bossRatio = b.bossHp / b.bossMax;
  const heroRatio = b.heroHp / b.heroMax;
  b.bossLag = Math.max(bossRatio, Phaser.Math.Linear(b.bossLag ?? bossRatio, bossRatio, 0.08));
  b.heroLag = Math.max(heroRatio, Phaser.Math.Linear(b.heroLag ?? heroRatio, heroRatio, 0.08));
  b.bossHurt = Math.max(0, (b.bossHurt || 0) - dt);
  b.heroHurt = Math.max(0, (b.heroHurt || 0) - dt);
  b.timer += dt;
  if (b.timer < 0.9 || b.result) { renderBoard(scene); return; }
  b.timer = 0;
  b.bossLag = Math.max(b.bossLag || bossRatio, bossRatio);
  b.heroLag = Math.max(b.heroLag || heroRatio, heroRatio);
  const crit = Math.random() < 0.15;
  const bossDmg = crit ? Math.floor(b.bossAtk * 1.6) : b.bossAtk;
  b.heroHp = Math.max(0, b.heroHp - bossDmg);
  b.bossHp = Math.max(0, b.bossHp - b.heroAtk);
  b.bossHurt = 0.24;
  b.heroHurt = 0.24;
  scene.flash.setAlpha(0.16);
  scene.cameras.main.shake(150, 0.006);
  spawnBattleDamage(scene, 402, 246, bossDmg, crit);
  spawnBattleDamage(scene, 132, 246, b.heroAtk, false, "#ff8a7a");
  spawnSlash(scene);
  scene.board.logs.unshift(`${b.bossName}이 ${bossDmg} 피해, ${b.heroName}가 ${b.heroAtk} 피해를 주었다.`);
  if (b.heroHp <= 0) {
    b.result = "win";
    scene.board.dungeon.soul += 60;
    scene.board.dungeon.notoriety += 18;
    spawnSoulParticles(scene, 402, 270);
    scene.board.logs.unshift("용사 침입을 막아냈다. 악명 +18, Soul +60");
  } else if (b.bossHp <= 0) {
    b.result = "lose";
    scene.board.dungeon.notoriety = Math.max(0, scene.board.dungeon.notoriety - 10);
    scene.board.logs.unshift("방어 실패. 악명 -10");
  }
  renderBoard(scene);
}

function renderBoard(scene) {
  scene.soundToggle?.setVisible(false).disableInteractive();
  scene.fullscreenToggle?.setVisible(false).disableInteractive();
  if (scene.boardUi) scene.boardUi.destroy(true);
  const c = scene.add.container(0, 0).setDepth(60);
  scene.boardUi = c;
  const b = scene.board;
  addRect(scene, c, 0, 0, W, H, UI_THEME.bg, 1);
  const hideHud = b.step === "intro" || b.step === "choose" || b.step === "chosen";
  if (!hideHud) {
    addText(scene, c, 18, 18, `악명 ${b.dungeon.notoriety}`, 15, "#d68cff");
    addText(scene, c, 150, 18, `Soul ${b.dungeon.soul}`, 15, "#f0c45c");
    addText(scene, c, 285, 18, `Gem ${b.dungeon.gem}`, 15, "#7fd8ff");
  }
  if (b.step === "intro") return renderIntro(scene, c);
  if (b.step === "choose") return renderChoose(scene, c);
  if (b.step === "chosen") return renderChosenSlime(scene, c);
  if (b.step === "battle") return renderBattle(scene, c);
  if (b.step === "heroChoice") return renderHeroChoice(scene, c);
  if (b.step === "monsterChoice") return renderMonsterChoice(scene, c);
  if (b.step === "exploreRun") return renderExploreRun(scene, c);
  if (b.tab === "dungeon") renderDungeon(scene, c);
  if (b.tab === "boss") renderBosses(scene, c);
  if (b.tab === "explore") renderExplore(scene, c);
  if (b.tab === "record") renderDex(scene, c);
  if (b.tab === "settings") renderSettings(scene, c);
  renderTabs(scene, c);
  if (b.helpTab) renderHelpModal(scene, c, b.helpTab);
}

function renderIntro(scene, c) {
  addRect(scene, c, 28, 86, 484, 640, UI_THEME.panel, 1, UI_THEME.border);
  addRect(scene, c, 44, 108, 452, 2, UI_THEME.borderHot, 0.8);
  addRect(scene, c, 44, 700, 452, 2, UI_THEME.borderHot, 0.35);
  const lines = [
    "용사가 던전을 정복했다.",
    "보물은 회수됐고, 이야기는 끝났다.",
    "",
    "하지만",
    "",
    "무너진 벽은 그대로였다.",
    "남은 몬스터들은 갈 곳이 없었다.",
    "",
    "여긴 18평짜리 축축한 동굴이다.",
    "누군가는 이곳을 회복시켜야 한다.",
    "",
    "다음 용사는 곧 도착한다.",
  ];
  const elapsed = scene.board.introTimer || 0;
  const charTime = 0.027;
  const lineGap = 0.25;
  let cursor = 0;
  let complete = true;
  lines.forEach((line, i) => {
    const y = 132 + i * 38;
    const len = line.length;
    const lineStart = cursor;
    const lineEnd = lineStart + len * charTime;
    cursor = lineEnd + lineGap;
    if (!line) return;
    if (elapsed < lineStart) { complete = false; return; }
    const isLast = i === lines.length - 1;
    const chars = Math.min(len, Math.floor((elapsed - lineStart) / charTime));
    if (chars < len) complete = false;
    let text = line.slice(0, chars);
    if (isLast && chars >= len) {
      const showDot = Math.floor(elapsed * 2.4) % 2 === 0;
      text = line.replace(/\.$/, showDot ? "." : "");
    }
    if (text) addText(scene, c, 48, y, text, isLast ? 20 : 17, UI_THEME.ink);
  });
  scene.board.introReady = complete;
  if (complete) {
    addButton(scene, c, 96, 776, 348, 64, "첫 수호자 소환", () => {
      localStorage.setItem("pob_intro_seen", "1");
      scene.board.step = "choose";
      renderBoard(scene);
    }, "growth");
  }
}

function renderChoose(scene, c) {
  addText(scene, c, 28, 92, "최초의 하수인을 선택하십시오", 24, UI_THEME.ink);
  addText(scene, c, 32, 128, "던전의 첫 지배자를 소환합니다.", 15, UI_THEME.muted);
  const candidates = scene.board.bosses.filter((b) => b.name !== "슬라임").slice(0, 3);
  candidates.forEach((boss, i) => {
    const y = 178 + i * 145;
    addRect(scene, c, 28, y, 484, 118, UI_THEME.panel2, 1, UI_THEME.border);
    addCodexSprite(scene, c, boss.codexId, 78, y + 60, 2.1);
    addText(scene, c, 130, y + 28, boss.name, 22, UI_THEME.ink);
    addText(scene, c, 130, y + 62, "소환 후보", 14, UI_THEME.muted);
    addButton(scene, c, 390, y + 36, 92, 46, "선택", () => recruitInitialBoss(scene, boss), "growth");
  });
  if (!candidates.length) addPanel(scene, c, 32, 180, 476, 120, ["사용 가능한 하수인 데이터가 없습니다."]);
}

function renderChosenSlime(scene, c) {
  const slime = scene.board.bosses.find((b) => b.recruited) || scene.board.bosses[0];
  const lines = [
    `${scene.board.chosenName} 소환 의식`,
    "앗, 먼저 던전 감정이 필요합니다.",
    "감정 결과에 따라 입주 가능한 하수인이 결정됩니다.",
    "하수인이 결정되었습니다.",
  ];
  const elapsed = scene.board.chosenTimer || 0;
  const charTime = 0.022;
  const lineGap = 0.28;
  let cursor = 0;
  let complete = true;
  addRect(scene, c, 28, 86, 484, 650, UI_THEME.panel, 1, UI_THEME.border);
  lines.forEach((line, i) => {
    const y = 104 + i * 44;
    const len = line.length;
    const start = cursor;
    const end = start + len * charTime;
    cursor = end + lineGap;
    if (elapsed < start) { complete = false; return; }
    const chars = Math.min(len, Math.floor((elapsed - start) / charTime));
    if (chars < len) complete = false;
    const textLine = line.slice(0, chars);
    if (textLine) addText(scene, c, 44, y, textLine, i === 0 ? 25 : 17, i === 0 ? "#f4f1e8" : UI_THEME.ink);
  });
  scene.board.chosenReady = complete;
  if (!complete) return;

  addPanel(scene, c, 32, 302, 476, 118, ["던전 감정 결과", "연면적 18평 / B1F", "마력 수용량: 매우 낮음", "소환 안정성: 하급 권장"]);
  addText(scene, c, 56, 478, "실제 입주 하수인", 18, "#aab0aa");
  addCodexSprite(scene, c, slime.codexId, W / 2, 570, 4.0);
  addText(scene, c, W / 2 - 42, 654, slime.name, 34, "#8cff7a");
  addText(scene, c, 44, 710, "계약서는 정상 처리되었습니다.", 16, "#f0b24b");
  addButton(scene, c, 150, 748, 240, 64, "던전 입주", () => enterDungeonAfterGuardian(scene), "growth", 95);
}

function renderDungeon(scene, c) {
  const d = scene.board.dungeon;
  addText(scene, c, 24, 80, d.name, 28, UI_THEME.ink);
  addHelpButton(scene, c, "dungeon");
  addText(scene, c, 24, 122, `${d.area}평   ${d.floor}   세대수 ${d.households}/${d.capacity}   하수인 ${d.bosses}`, 17, "#c9c2b8");

  addRect(scene, c, 24, 158, 492, 548, 0x050706, 1, 0x263129);
  const src = scene.textures.get("dungeonInterior").getSourceImage();
  const boxW = 468, boxH = 524;
  const bgH = boxH;
  const bgW = bgH * (src.width / src.height);
  const bg = scene.add.image(270, 432, "dungeonInterior")
    .setDisplaySize(bgW, bgH)
    .setDepth(60);
  const maskShape = scene.add.rectangle(36, 170, boxW, boxH, 0xffffff, 0).setOrigin(0).setVisible(false);
  bg.setMask(maskShape.createGeometryMask());
  c.add([bg, maskShape]);
  addRect(scene, c, 36, 170, 468, 524, 0x000000, 0.24);
  addRect(scene, c, 24, 716, 492, 82, 0x090d0d, 0.9, 0x263129);
  addText(scene, c, 42, 730, "던전 관찰 로그", 14, "#8bd17c");
  (scene.board.dungeonFeed || []).slice(0, 3).forEach((line, i) => {
    addText(scene, c, 42, 754 + i * 18, line, 13, i === 0 ? "#f4f1e8" : "#9fa89d");
  });

  const targetCount = Math.max(6, Math.min(18, d.households));
  refillDungeonDwellers(scene, targetCount);
  normalizeDungeonBoss(scene);
  const visibleCount = Math.min(scene.board.dwellers.length, targetCount);
  scene.board.dungeonActors = [];
  scene.board.dwellers.slice(0, visibleCount).forEach((m) => {
    const key = ensureCodexTexture(scene, m.id, m.frame || 0);
    let actor;
    if (key) actor = scene.add.image(m.x, m.y, key).setScale(m.kind === "boss" ? 1.9 : m.kind === "hero" ? 1.35 : 1.55);
    else actor = scene.add.circle(m.x, m.y, m.kind === "boss" ? 8 : 5, m.kind === "hero" ? 0xd86652 : 0x8bd17c, 0.95);
    actor.setDepth(63 + m.y / 1000).setAlpha(m.kind === "hero" ? 0.82 : 0.96);
    if (m.kind === "hero") actor.setTint(0xffc2aa);
    if (m.kind === "boss") actor.setTint(0xfff0a8);
    c.add(actor);
    m.actor = actor;
    scene.board.dungeonActors.push(actor);
    if (m.kind === "boss") {
      m.badge = addText(scene, c, m.x + 16, m.y - 25, "★", 18, "#ffd76a").setDepth(67 + m.y / 1000);
      scene.board.dungeonActors.push(m.badge);
    } else m.badge = null;
  });
  for (const fx of scene.board.dustEffects || []) {
    fx.actor?.destroy();
    fx.actor = scene.add.image(fx.x, fx.y, ensureDustTexture(scene, fx.frame || 0)).setDepth(64).setScale(1.8).setAlpha(scene.board.helpTab ? 0 : 0.9);
    c.add(fx.actor);
  }

}

function renderExplore(scene, c) {
  addText(scene, c, 24, 76, "순찰 구역", 26, UI_THEME.ink);
  addHelpButton(scene, c, "explore");
  const page = scene.board.patrolPage || 0;
  const areas = scene.board.areas.slice(page * 4, page * 4 + 4);
  areas.forEach((a, i) => {
    const y = 125 + i * 116;
    const reputationLocked = scene.board.dungeon.notoriety < a.req;
    const needsOpen = !reputationLocked && !a.unlocked;
    const locked = reputationLocked || needsOpen;
    addRect(scene, c, 24, y, 492, 92, locked ? 0x0b0d0d : 0x101513, 1, locked ? 0x333333 : 0x314832);
    addText(scene, c, 42, y + 14, `${a.dungeonNo}. ${a.name}`, 17, locked ? "#777" : "#f4f1e8");
    const status = reputationLocked ? `악명 ${a.req} 필요` : needsOpen ? `악명 도달 · Soul ${a.unlockCost} 소모` : `권장 ${a.diff}`;
    addText(scene, c, 42, y + 41, status, 14, reputationLocked ? "#c55" : needsOpen ? "#f0c45c" : "#8bd17c");
    addText(scene, c, 42, y + 63, a.desc || "", 12, locked ? "#666" : "#aab0aa");
    if (needsOpen) {
      addButton(scene, c, 380, y + 22, 94, 42, "개방", () => unlockPatrolArea(scene, page * 4 + i), scene.board.dungeon.soul >= a.unlockCost ? "growth" : "disabled");
    } else if (!locked) {
      const patrolBoss = getPatrolBoss(scene);
      addButton(scene, c, 380, y + 22, 94, 42, patrolBoss.ap > 0 ? "순찰 시작" : "AP 없음", () => startExploreRun(scene, page * 4 + i), patrolBoss.ap > 0 ? "explore" : "disabled");
    }
  });
  addPager(scene, c, 620, page, Math.ceil(scene.board.areas.length / 4), (next) => {
    scene.board.patrolPage = next;
    renderBoard(scene);
  });
}

function renderBosses(scene, c) {
  addText(scene, c, 24, 76, "하수인", 26, UI_THEME.ink);
  addHelpButton(scene, c, "boss");
  const owned = scene.board.bosses.filter((boss) => boss.recruited);
  owned.forEach((boss, i) => {
    const y = 130 + i * 128;
    addRect(scene, c, 24, y, 492, 105, 0x102010, 1, 0x3b8b3b);
    addCodexSprite(scene, c, boss.codexId, 72, y + 54, 2.1);
    addText(scene, c, 120, y + 14, boss.name, 19, "#f4f1e8");
    addText(scene, c, 120, y + 42, `Lv.${boss.lv}  EXP ${boss.exp || 0}/${boss.nextExp || 100}  AP ${boss.ap || 0}/${boss.maxAp || 3}`, 14, "#c9c2b8");
    addText(scene, c, 120, y + 66, `HP ${boss.hp}/${boss.maxHp}  공격 ${boss.atk}  방어 ${boss.def}  민첩 ${boss.spd}`, 13, "#8bd17c");
    addText(scene, c, 386, y + 16, `${boss.grade}급`, 15, "#f0c45c");
    addText(scene, c, 386, y + 42, boss.status, 13, "#aab0aa");
  });
  if (!owned.length) addPanel(scene, c, 24, 150, 492, 110, ["보유 하수인 없음"]);
}

function renderSettings(scene, c) {
  addText(scene, c, 24, 76, "설정", 26, UI_THEME.ink);
  addHelpButton(scene, c, "settings");
  addPanel(scene, c, 24, 124, 492, 106, ["게임 목표", "필드보스를 순찰에 보내 몬스터를 영입하고 자원을 회수하세요.", "Soul로 던전을 확장하고 침입하는 용사에 대응합니다."]);
  addRect(scene, c, 24, 258, 492, 280, UI_THEME.panel, 1, UI_THEME.border);
  addText(scene, c, 48, 288, "시스템", 21, UI_THEME.gold);
  addButton(scene, c, 54, 338, 190, 58, scene.state.soundOn ? "소리 ON" : "소리 OFF", () => { toggleSound(scene); renderBoard(scene); }, scene.state.soundOn ? "growth" : "default");
  addButton(scene, c, 294, 338, 190, 58, scene.state.fullscreenOn ? "화면 축소" : "전체화면", () => { toggleFullscreen(scene); setTimeout(() => renderBoard(scene), 140); }, "primary");
  addButton(scene, c, 54, 428, 430, 58, "데모 데이터 초기화", () => showStartResetConfirm(scene), "danger");
  addText(scene, c, 48, 566, "데모용 기능입니다. 초기화하면 인트로 표시 여부도 초기화됩니다.", 13, UI_THEME.muted);
}


function unlockPatrolArea(scene, idx) {
  const area = scene.board.areas[idx];
  const d = scene.board.dungeon;
  if (!area || area.unlocked) return renderBoard(scene);
  if (d.notoriety < area.req) { scene.board.logs.unshift(`악명 ${area.req}이 필요하다.`); return renderBoard(scene); }
  if (d.soul < area.unlockCost) { scene.board.logs.unshift(`Soul ${area.unlockCost}이 필요하다.`); return renderBoard(scene); }
  d.soul -= area.unlockCost;
  area.unlocked = true;
  scene.board.logs.unshift(`${area.name} 순찰구역을 개방했다. Soul -${area.unlockCost}`);
  renderBoard(scene);
}

function renderHeroChoice(scene, c) {
  const run = scene.board.exploreRun;
  const event = scene.board.pendingHeroEvent;
  addText(scene, c, 24, 76, "용사 출현", 28, "#ff8a7a");
  addText(scene, c, 24, 116, `${run?.steps || 0}걸음째, ${event?.entityName || "용사"}를 만났다.`, 16, "#c9c2b8");
  addRect(scene, c, 32, 168, 476, 250, UI_THEME.panel, 1, 0x8b4037);
  addCodexSprite(scene, c, run.boss.codexId, 138, 292, 3.0);
  if (event?.entityId) addCodexSprite(scene, c, event.entityId, 390, 292, 2.35);
  addText(scene, c, 106, 360, run.boss.name, 15, "#ffd76a");
  addText(scene, c, 344, 360, event?.entityName || "용사", 15, "#ff8a7a");
  addText(scene, c, 204, 278, "VS", 30, UI_THEME.gold);
  addLogPanel(scene, c, 32, 454, 476, 120, ["어떻게 대응할까?", "싸우면 전투에 진입합니다.", "도망은 HP 소모가 없지만 실패할 수 있습니다."]);
  addButton(scene, c, 58, 630, 190, 64, "싸워!", () => fightHeroFromPatrol(scene), "danger");
  addButton(scene, c, 292, 630, 190, 64, "도망!", () => fleeHeroFromPatrol(scene), "default");
}

function fightHeroFromPatrol(scene) {
  const event = scene.board.pendingHeroEvent;
  scene.board.pendingHeroEvent = null;
  startBoardBattle(scene, event);
}

function fleeHeroFromPatrol(scene) {
  const run = scene.board.exploreRun;
  const event = scene.board.pendingHeroEvent;
  scene.board.pendingHeroEvent = null;
  const success = Math.random() < 0.68;
  if (!success) {
    run.shown.push(`${event?.entityName || "용사"}에게 도망 경로를 들켰다.`);
    return startBoardBattle(scene, event);
  }
  run.shown.push(`${event?.entityName || "용사"}와의 충돌을 피했다.`);
  run.shown.push("아무 소모 없이 순찰을 계속한다.");
  run.event += 1;
  run.line = 0;
  run.timer = 0;
  if (run.event >= run.nodes.length) finishPatrolSteps(scene);
  scene.board.step = "exploreRun";
  renderBoard(scene);
}

function renderMonsterChoice(scene, c) {
  const run = scene.board.exploreRun;
  const event = scene.board.pendingMonsterEvent;
  addText(scene, c, 24, 76, "몬스터 발견", 28, "#8bd17c");
  addText(scene, c, 24, 116, `${run?.steps || 0}걸음째, ${event?.entityName || "떠돌이 몬스터"}를 만났다.`, 16, "#c9c2b8");
  addRect(scene, c, 32, 168, 476, 250, UI_THEME.panel, 1, 0x314832);
  addCodexSprite(scene, c, run.boss.codexId, 138, 292, 3.0);
  if (event?.entityId) addCodexSprite(scene, c, event.entityId, 390, 292, 2.4);
  addText(scene, c, 106, 360, run.boss.name, 15, "#ffd76a");
  addText(scene, c, 326, 360, event?.entityName || "몬스터", 15, "#8bd17c");
  addLogPanel(scene, c, 32, 454, 476, 120, ["어떻게 할까?", "영입을 시도하거나 그냥 지나갈 수 있습니다.", "성향은 보이지 않지만 성공률에 영향을 줍니다."]);
  if (scene.board.recruitMethodOpen) {
    addButton(scene, c, 44, 620, 210, 58, "힘으로 제압", () => resolveMonsterRecruit(scene, "force"), "danger");
    addButton(scene, c, 286, 620, 210, 58, "Soul로 꼬신다", () => resolveMonsterRecruit(scene, "soul"), scene.board.dungeon.soul > 0 ? "growth" : "disabled");
    addButton(scene, c, 176, 704, 188, 52, "지나간다", () => skipMonsterRecruit(scene), "default");
  } else {
    addButton(scene, c, 58, 630, 190, 64, "영입한다", () => { scene.board.recruitMethodOpen = true; renderBoard(scene); }, "growth");
    addButton(scene, c, 292, 630, 190, 64, "지나간다", () => skipMonsterRecruit(scene), "default");
  }
}

function resolveMonsterRecruit(scene, method) {
  const run = scene.board.exploreRun;
  const event = scene.board.pendingMonsterEvent;
  if (!run || !event) return;
  if (method === "soul" && scene.board.dungeon.soul <= 0) return renderBoard(scene);
  rollMonsterRecruit(scene, event, method);
  for (const line of event.lines) run.shown.push(line);
  scene.board.pendingMonsterEvent = null;
  scene.board.recruitMethodOpen = false;
  continuePatrolAfterChoice(scene);
}

function skipMonsterRecruit(scene) {
  const run = scene.board.exploreRun;
  const event = scene.board.pendingMonsterEvent;
  if (run) run.shown.push(`${event?.entityName || "몬스터"}를 지나쳤다.`);
  scene.board.pendingMonsterEvent = null;
  scene.board.recruitMethodOpen = false;
  continuePatrolAfterChoice(scene);
}

function continuePatrolAfterChoice(scene) {
  const run = scene.board.exploreRun;
  if (!run) return;
  run.event += 1;
  run.line = 0;
  run.timer = 0;
  if (run.event >= run.nodes.length) finishPatrolSteps(scene);
  scene.board.step = "exploreRun";
  renderBoard(scene);
}

function finishPatrolSteps(scene) {
  const run = scene.board.exploreRun;
  if (!run) return;
  run.steps = result?.steps ?? run.maxSteps;
  const lastLine = run.shown[run.shown.length - 1] || "";
  if (!/(귀환|도달|기절)/.test(lastLine)) {
    run.shown.push(run.hp <= 0 ? `${run.boss.name}이 기절해 귀환했다.` : `${run.steps}걸음 지점에서 순찰을 마치고 귀환한다.`);
  }
  run.finished = true;
  run.timer = 0;
}

function renderBattle(scene, c) {
  const b = scene.board.battle;
  addText(scene, c, 24, 78, "용사 침입!", 28, "#ff5555");
  addText(scene, c, 24, 120, "B1F · 거주구", 17, "#c9c2b8");
  addRect(scene, c, 24, 152, 492, 300, 0x090c0b, 1, 0x29312e);
  const bossX = 132 + (b.bossHurt ? -8 : 0);
  const heroX = 402 + (b.heroHurt ? 8 : 0);
  const frame = Math.floor((b.timer || 0) * 8) & 3;
  const bossKey = ensureCodexTexture(scene, b.bossCodexId, frame);
  const heroKey = ensureCodexTexture(scene, b.heroCodexId, frame);
  if (bossKey) c.add(scene.add.image(bossX, 280, bossKey).setDepth(62).setScale(3.4).setAlpha(b.bossHurt ? 0.65 : 1));
  if (heroKey) c.add(scene.add.image(heroX, 280, heroKey).setDepth(62).setScale(2.8).setAlpha(b.heroHurt ? 0.65 : 1).setFlipX(true));
  addText(scene, c, 254, 260, "VS", 28, "#f0c45c");
  drawHp(scene, c, 50, 388, 190, b.bossHp / b.bossMax, b.bossLag, b.bossName, `${b.bossHp}/${b.bossMax}`, b.bossHurt);
  drawHp(scene, c, 300, 388, 190, b.heroHp / b.heroMax, b.heroLag, b.heroName, `${b.heroHp}/${b.heroMax}`, b.heroHurt);
  renderBattleFx(scene, c);
  addText(scene, c, 24, 505, "지배자의 권능", 20, "#f4f1e8");
  const powerKind = scene.board.powerUsed ? "disabled" : "power";
  addButton(scene, c, 24, 545, 145, 60, "회복", () => usePower(scene, "heal"), powerKind);
  addButton(scene, c, 198, 545, 145, 60, "약화", () => usePower(scene, "weaken"), powerKind);
  addButton(scene, c, 372, 545, 145, 60, "보호막", () => usePower(scene, "shield"), powerKind);
  if (b.result) addButton(scene, c, 150, 645, 240, 62, "복귀", () => { scene.board.step = "main"; scene.board.tab = "dungeon"; renderBoard(scene); }, "primary");
  addPanel(scene, c, 24, 730, 492, 150, scene.board.logs.slice(0, 5));
}

function renderDex(scene, c) {
  const data = codexData();
  const dungeonNo = scene.board.dexDungeon || 1;
  const dungeon = data.dungeons.find((d) => d.no === dungeonNo) || data.dungeons[0];
  addText(scene, c, 24, 76, "몬스터 · 보스 도감", 25, UI_THEME.ink);
  addHelpButton(scene, c, "record");
  addText(scene, c, 28, 112, `${dungeon.no}. ${dungeon.name}`, 16, dungeon.hue || "#8bd17c");
  addText(scene, c, 390, 116, `권장 ${dungeon.rec}`, 14, "#c9c2b8");
  const list = data.monsters.filter((m) => m.d === dungeonNo).sort((a, b) => (a.dep === "BOSS" ? 1 : 0) - (b.dep === "BOSS" ? 1 : 0) || a.lv - b.lv);
  list.forEach((m, i) => {
    const y = 150 + i * 68;
    const isBoss = m.dep === "BOSS";
    addRect(scene, c, 24, y, 492, 60, isBoss ? 0x241d15 : 0x101513, 1, isBoss ? 0xf0c45c : 0x314832);
    addRect(scene, c, 36, y + 9, 42, 42, 0x070909, 1, 0x26362b);
    const discovered = isCodexDiscovered(scene, m.id);
    addCodexSprite(scene, c, m.id, 57, y + 30, isBoss ? 1.35 : 1.15, { hidden: !discovered });
    addText(scene, c, 92, y + 8, discovered ? `${m.n}${isBoss ? "  FIELD BOSS" : ""}` : "???", 15, isBoss ? "#ffd76a" : "#f4f1e8");
    addText(scene, c, 92, y + 30, discovered ? `${m.dep} · ${m.el} · ${"★".repeat(m.r)} · Lv.${m.lv}` : "미발견", 12, "#c9c2b8");
    addText(scene, c, 305, y + 30, discovered ? `HP ${m.hp} 공 ${m.at} 방 ${m.df} 민 ${m.sd}` : "순찰 중 만나면 기록", 11, discovered ? "#8bd17c" : "#777");
  });
  addPager(scene, c, 690, dungeonNo - 1, data.dungeons.length, (next) => {
    scene.board.dexDungeon = next + 1;
    renderBoard(scene);
  });
}


function addHelpButton(scene, c, tab) {
  addButton(scene, c, 468, 74, 38, 38, "?", () => {
    scene.board.helpTab = tab;
    renderBoard(scene);
  }, "primary");
}

function helpLines(tab) {
  return {
    dungeon: ["던전", "현재 던전 상태와 입주 세력을 확인합니다.", "몬스터와 침입자가 만나면 자동으로 충돌합니다.", "하수인은 별표로 표시됩니다."],
    explore: ["순찰", "하수인을 순찰에 보내 자원과 몬스터를 확보하세요.", "몬스터마다 보이지 않는 성향이 있어 영입 확률이 달라집니다.", "영입 시도에는 실패, 성공, 대성공 결과가 존재합니다."],
    boss: ["하수인", "보유한 하수인의 성장 상태를 확인합니다.", "순찰을 반복하면 경험치가 쌓입니다.", "행동력은 시간이 지나면 다시 충전됩니다."],
    record: ["도감", "던전에서 발견했거나 영입 가능한 존재를 확인합니다.", "몬스터와 하수인 후보의 기본 능력치를 비교할 수 있습니다.", "나중에는 미발견 대상이 검은 실루엣으로 표시됩니다."],
    settings: ["설정", "소리와 전체화면 상태를 바꿉니다.", "데모 데이터 초기화로 처음 상태를 다시 확인할 수 있습니다.", "보드 화면의 시스템 조작은 이곳에 모았습니다."],
  }[tab] || ["도움말", "현재 화면의 기능을 안내합니다."];
}

function renderHelpModal(scene, c, tab) {
  const lines = helpLines(tab);
  addRect(scene, c, 0, 0, W, H, 0x000000, 0.58, null, 90);
  addRect(scene, c, 42, 292, 456, 294, UI_THEME.panel, 1, UI_THEME.borderHot, 91);
  addText(scene, c, 72, 324, lines[0], 24, UI_THEME.gold, 92);
  lines.slice(1).forEach((line, i) => addText(scene, c, 72, 376 + i * 36, line, 15, UI_THEME.ink, 92));
  addButton(scene, c, 176, 510, 188, 54, "확인", () => {
    scene.board.helpTab = null;
    renderBoard(scene);
  }, "primary", 92);
}

function renderTabs(scene, c) {
  [["던전","dungeon"],["하수인","boss"],["순찰","explore"],["도감","record"],["설정","settings"]].forEach(([label, tab], i) => {
    addButton(scene, c, 14 + i * 103, H - 86, 94, 58, label, () => { scene.board.tab = tab; renderBoard(scene); }, scene.board.tab === tab ? "tabActive" : "tab");
  });
}

function getPatrolBoss(scene) {
  return scene.board.bosses.find((b) => b.recruited);
}

function addBossExp(scene, boss, amount) {
  boss.exp = (boss.exp || 0) + amount;
  boss.nextExp = boss.nextExp || 100;
  while (boss.exp >= boss.nextExp) {
    boss.exp -= boss.nextExp;
    boss.lv += 1;
    boss.maxHp += 10;
    boss.hp = Math.min(boss.hp, boss.maxHp);
    boss.atk += 2;
    boss.def += 1;
    boss.spd += 1;
    scene.board.exploreRun.rewards.levelUps += 1;
    scene.board.exploreRun.shown.push(`${boss.name} 레벨 상승! Lv.${boss.lv}`);
  }
}

function hiddenRecruitTrait(mon) {
  const traits = ["timid", "rough", "greedy", "stubborn", "wanderer"];
  return traits[Math.abs((mon?.id || 0) * 9301 + 49297) % traits.length];
}

function rollMonsterRecruit(scene, event, methodKey = "force") {
  const run = scene.board.exploreRun;
  const d = scene.board.dungeon;
  const mon = codexById(event.entityId) || { id: event.entityId, n: event.entityName };
  const trait = hiddenRecruitTrait(mon);
  const useSoul = methodKey === "soul";
  const method = useSoul ? "Soul로 꼬신다" : "힘으로 제압한다";
  if (useSoul) { d.soul = Math.max(0, d.soul - 1); run.rewards.soul -= 1; }
  else run.hp = Math.max(1, run.hp - 1);
  let rate = useSoul ? 0.7 : 0.55;
  if (trait === "timid" && useSoul) rate += 0.15;
  if (trait === "rough" && !useSoul) rate += 0.15;
  if (trait === "greedy" && useSoul) rate += 0.2;
  if (trait === "stubborn") rate -= 0.15;
  if (trait === "wanderer") rate += 0.1;
  const roll = Math.random();
  const great = roll < Math.max(0.05, rate * 0.18);
  const success = great || roll < rate;
  event.effect = useSoul ? "heart" : "dust";
  if (success) {
    d.households = Math.min(d.capacity, d.households + (great ? 2 : 1));
    run.rewards.monsters += great ? 2 : 1;
    scene.board.ownedMonsterIds?.add?.(event.entityId);
    scene.board.discoveredCodex?.add?.(event.entityId);
  }
  event.lines = [
    "떠돌이 몬스터를 만났다.",
    `${event.entityName || "작은 몬스터"}에게 ${method} 방식으로 영입을 제안했다.`,
    great ? "대성공 / 세대수 +2" : success ? "영입 성공 / 세대수 +1" : "영입 실패 / 다음 기회를 노린다.",
  ];
}

function makeEntityEvent(area, kind) {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  if (kind === "monster") {
    const m = pick(codexPoolForArea(area, "monster"));
    return { title: "영입", kind, entityId: m?.id, entityName: m?.n || "떠돌이 몬스터", lines: ["떠돌이 몬스터를 만났다.", "영입한다 / 지나간다", "방식을 고르는 중..."] };
  }
  if (kind === "hero") {
    const h = pick(codexPoolForArea(area, "hero"));
    const damage = Phaser.Math.Between(12, 28) + Math.floor((area.dungeonNo || 1) * 2.5);
    return { title: "용사", kind, entityId: h?.id, entityName: h?.n || "용사", damage, lines: ["적군인 용사를 만났다.", `${h?.n || "용사"}와 짧게 충돌했다.`, `HP -${damage} / 악명 +10 / Soul +20`] };
  }
  if (kind === "boss") {
    const b = pick(codexPoolForArea(area, "boss"));
    return { title: "필드보스", kind, entityId: b?.id, entityName: b?.n || "필드보스", lines: ["낯선 필드보스와 대면했다.", `${b?.n || "누군가"}가 이 던전의 기척을 살폈다.`, "관심도 +1"] };
  }
  if (kind === "soul") return { title: "자원", kind, lines: ["자원을 발견했다.", `${area.name} 어딘가에서 Soul 결정이 빛난다.`, "Soul +35"] };
  return { title: "고요", kind: "none", lines: ["아무것도 없다.", `${area.name}에는 낮은 숨소리만 남아 있다.`, "순찰은 계속된다."] };
}

function buildPatrolEvents(idx) {
  const area = sceneSafeArea(idx);
  return ["none", "monster", "soul", "hero"].map((kind) => makeEntityEvent(area, kind));
}

function sceneSafeArea(idx) {
  const areas = window.__lastBoardAreas || makeBoardAreas();
  return areas[idx] || areas[0] || { name: "축축한 통로", dungeonNo: 1 };
}

function rollPatrolEvents(idx, scene = null) {
  const area = scene?.board?.areas?.[idx] || sceneSafeArea(idx);
  const maxSteps = Phaser.Math.Between(56 + area.dungeonNo * 4, 80 + area.dungeonNo * 6);
  const picked = [];
  let step = Phaser.Math.Between(4, 9);
  while (step < maxSteps) {
    const kind = Math.random() < 0.58 ? "monster" : "hero";
    const event = makeEntityEvent(area, kind);
    event.step = step;
    picked.push(event);
    step += Phaser.Math.Between(4, 9);
  }
  picked.maxSteps = maxSteps;
  return picked;
}

function applyPatrolEvent(scene, event) {
  const d = scene.board.dungeon;
  const run = scene.board.exploreRun;
  const boss = run.boss;
  const expGain = { none: 5, monster: 10, soul: 10, hero: 20, boss: 15 }[event.kind] || 8;
  addBossExp(scene, boss, expGain);
  run.rewards.exp += expGain;
  if (event.kind === "monster") return;
  if (event.kind === "soul") { d.soul += 35; run.rewards.soul += 35; }
  if (event.kind === "hero") { d.soul += 20; d.notoriety += 10; run.rewards.soul += 20; run.rewards.notoriety += 10; run.hp = Math.max(0, run.hp - (event.damage || 20)); }
  if (event.kind === "boss") {
    const area = scene.board.areas[run.idx];
    area.progress = Math.min(area.max, area.progress + 1);
    run.rewards.clues += 1;
    const target = scene.board.bosses.find((b) => b.codexId === event.entityId);
    if (target && !target.recruited) {
      target.interest = Math.min(target.need, (target.interest || 0) + 1);
      target.status = target.interest >= target.need ? "영입 가능" : "관심";
    }
  }
  scene.board.logs.unshift(event.lines[0]);
}

function startExploreRun(scene, idx) {
  const area = scene.board.areas[idx];
  if (!area || !area.unlocked || scene.board.dungeon.notoriety < area.req) return renderBoard(scene);
  const boss = getPatrolBoss(scene);
  if (!boss || boss.ap <= 0) { scene.board.logs.unshift("순찰 가능한 행동력이 부족하다."); return renderBoard(scene); }
  boss.ap -= 1;
  boss.status = "순찰";
  scene.board.tourOpen = true;
  const nodes = rollPatrolEvents(idx, scene);
  scene.board.exploreRun = { idx, boss, event: 0, line: 0, timer: 0, steps: 0, maxSteps: nodes.maxSteps || 64, nodes, shown: [`${boss.name}이 ${area.name} 순찰을 시작했다.`], rewards: { soul: 0, notoriety: 0, monsters: 0, clues: 0, exp: 0, levelUps: 0 }, hp: boss.hp, maxHp: boss.maxHp, finished: false };
  scene.board.typewriter = { full: scene.board.exploreRun.shown.join("\n"), chars: 0 };
  scene.board.logs.unshift(`${boss.name}이 ${area.name} 순찰을 시작했다.`);
  openComppTour(scene);
}

function renderExploreRun(scene, c) {
  const run = scene.board.exploreRun;
  const area = scene.board.areas[run.idx];
  addText(scene, c, 24, 76, run.finished ? "순찰 결과" : area.name, 26, "#f4f1e8");
  addText(scene, c, 24, 116, run.finished ? `${run.boss.name} 귀환 보고` : `${run.boss.name}이 던전 안을 순찰 중`, 16, "#c9c2b8");

  addRect(scene, c, 32, 146, 216, 96, 0x101513, 1, 0x314832);
  addCodexSprite(scene, c, run.boss.codexId, 78, 194, 2.2);
  addText(scene, c, 122, 164, run.boss.name, 17, "#ffd76a");
  if (!run.finished) addText(scene, c, 122, 186, `걸음 ${run.steps || 0}/${run.maxSteps || 0}`, 12, "#aab0aa");
  addMiniHp(scene, c, 122, run.finished ? 202 : 213, 92, run.hp, run.maxHp);

  const current = run.nodes[Math.min(run.event, run.nodes.length - 1)];
  if (!run.finished && current?.entityId) {
    addRect(scene, c, 292, 146, 192, 96, 0x101513, 1, 0x314832);
    addCodexSprite(scene, c, current.entityId, 334, 194, current.kind === "boss" ? 1.8 : 1.45);
    addText(scene, c, 376, 166, current.title, 14, current.kind === "hero" ? "#ff8a7a" : current.kind === "boss" ? "#ffd76a" : "#8bd17c");
    addText(scene, c, 376, 190, current.entityName || "", 12, "#c9c2b8");
  }

  const logLines = run.finished ? run.shown : typedPatrolLines(scene, run.shown);
  addLogPanel(scene, c, 32, 270, 476, run.finished ? 250 : 350, logLines.slice(-9));
  if (run.finished) {
    addLogPanel(scene, c, 32, 545, 476, 115, patrolSummary(run));
    addButton(scene, c, 150, 690, 240, 66, "귀환", () => finishPatrol(scene), "explore");
  } else addText(scene, c, 190, 660, "순찰 진행 중...", 17, "#aab0aa");
}




function openComppTour(scene) {
  closeComppTour(false);
  scene.sfx?.bgm?.stop();
  const wrap = document.createElement("div");
  wrap.id = "boardTourOverlay";
  Object.assign(wrap.style, {
    position: "fixed", inset: "0", zIndex: "9999", background: "#000",
    display: "flex", alignItems: "center", justifyContent: "center",
  });
  const frame = document.createElement("iframe");
  const run = scene.board?.exploreRun;
  const dungeonNo = run ? scene.board.areas[run.idx]?.dungeonNo || 1 : 1;
  const boss = run?.boss;
  const qs = new URLSearchParams({ v: "20260826be", dungeon: dungeonNo, boss: boss?.name || "순찰자", hp: boss?.hp || 90, maxHp: boss?.maxHp || 90, atk: boss?.atk || 18, def: boss?.def || 0, maxSteps: run?.maxSteps || 64 });
  frame.src = `new_/patrol_tour.html?${qs.toString()}`;
  frame.title = "BOARD-TOUR patrol";
  Object.assign(frame.style, {
    width: "min(100vw, 540px)", height: "100dvh", maxHeight: "960px",
    border: "0", background: "#000",
  });
  if (window.__pobTourMessageHandler) window.removeEventListener("message", window.__pobTourMessageHandler);
  window.__pobTourMessageHandler = (event) => {
    if (event?.data?.type === "pob-tour-complete") completeComppTour(scene, event.data.result);
  };
  window.addEventListener("message", window.__pobTourMessageHandler);
  wrap.appendChild(frame);
  document.body.appendChild(wrap);
}

function closeComppTour(render = true) {
  const old = document.getElementById("boardTourOverlay");
  if (old) old.remove();
  if (window.__pobTourMessageHandler) {
    window.removeEventListener("message", window.__pobTourMessageHandler);
    window.__pobTourMessageHandler = null;
  }
  if (render && window.__pobScene?.board) renderBoard(window.__pobScene);
}

function completeComppTour(scene, result = null) {
  const run = scene.board?.exploreRun;
  if (!run || run.finished) return closeComppTour(true);
  const d = scene.board.dungeon;
  if (result) {
    const soulGain = Number(result.soul || 0);
    const notorietyGain = Number(result.notoriety || 0);
    d.soul = Math.max(0, d.soul + soulGain);
    d.notoriety += notorietyGain;
    d.households = Math.min(d.capacity, d.households + (result.households || 0));
    run.hp = result.hp ?? run.hp;
    if (result.steps !== undefined) run.steps = result.steps;
    run.rewards.soul += soulGain;
    run.rewards.notoriety += notorietyGain;
    run.rewards.monsters += result.households || 0;
    run.rewards.exp += result.exp || 0;
    if (result.exp) addBossExp(scene, run.boss, result.exp);
    run.maxHp = run.boss.maxHp;
    run.hp = Math.min(run.maxHp, Math.max(0, run.hp));
    if (result.bossRecruit?.id) {
      const target = scene.board.bosses.find((boss) => boss.codexId === result.bossRecruit.id);
      if (target && !target.recruited) {
        target.recruited = true;
        target.status = '상주';
        target.ap = target.maxAp || 3;
        scene.board.dungeon.bosses += 1;
        scene.board.ownedMonsterIds?.add?.(target.codexId);
        scene.board.discoveredCodex?.add?.(target.codexId);
      }
    }
    for (const line of result.logs || []) run.shown.push(line);
  }
  run.steps = result?.steps ?? run.maxSteps;
  const lastLine = run.shown[run.shown.length - 1] || "";
  if (!/(귀환|도달|기절)/.test(lastLine)) {
    run.shown.push(run.hp <= 0 ? `${run.boss.name}이 기절해 귀환했다.` : `${run.steps}걸음 지점에서 순찰을 마치고 귀환한다.`);
  }
  run.finished = true;
  scene.board.step = "exploreRun";
  closeComppTour(false);
  if (scene.state.soundOn && !scene.sfx.bgm.isPlaying) safePlay(scene.sfx.bgm);
  renderBoard(scene);
}

function advancePatrolLine(scene) {
  const run = scene.board.exploreRun;
  const event = run.nodes[run.event];
  if (!event) return finishPatrolSteps(scene);
  if (run.line === 0) {
    run.steps = event.step || run.steps || 0;
    if (event.kind === "hero") {
      scene.board.pendingHeroEvent = event;
      run.shown.push(`${run.steps}걸음째, 적군인 용사를 만났다.`);
      scene.board.step = "heroChoice";
      renderBoard(scene);
      return;
    }
    if (event.kind === "monster") {
      scene.board.pendingMonsterEvent = event;
      run.shown.push(`${run.steps}걸음째, 떠돌이 몬스터를 만났다.`);
      scene.board.step = "monsterChoice";
      scene.board.recruitMethodOpen = false;
      renderBoard(scene);
      return;
    }
    applyPatrolEvent(scene, event);
  }
  run.shown.push(event.lines[run.line]);
  run.line += 1;
  if (run.hp <= 25) {
    run.shown.push("슬라임의 체력이 낮아 순찰을 빨리 마쳤다.");
    run.finished = true;
    run.timer = 0;
    return;
  }
  if (run.line >= event.lines.length) {
    run.event += 1;
    run.line = 0;
    if (run.event >= run.nodes.length) {
      run.steps = run.maxSteps;
      run.shown.push(`${run.maxSteps}걸음 도달. 순찰을 마치고 귀환한다.`);
      exploreArea(scene, run.idx, false);
      run.finished = true;
      run.timer = 0;
    }
  }
}

function typedPatrolLines(scene, lines) {
  const full = lines.join("\n");
  const tw = scene.board.typewriter || (scene.board.typewriter = { full, chars: 0 });
  if (tw.full !== full) {
    tw.chars = Math.min(tw.chars || 0, tw.full.length);
    tw.full = full;
  }
  const done = tw.chars >= full.length;
  const cursor = Math.floor((scene.time.now || 0) / 320) % 2 === 0 ? "▌" : "";
  return (full.slice(0, Math.floor(tw.chars)) + (done ? cursor : "▌")).split("\n");
}

function updateBattleFx(scene, dt) {
  const fx = scene.board.battleFx || (scene.board.battleFx = { popups: [], particles: [], slash: 0 });
  fx.slash = Math.max(0, (fx.slash || 0) - dt);
  fx.popups = fx.popups.filter((p) => (p.t += dt) < 0.7);
  fx.particles = fx.particles.filter((p) => (p.t += dt) < 0.9);
}

function spawnBattleDamage(scene, x, y, value, crit = false, color = "#ffffff") {
  const fx = scene.board.battleFx || (scene.board.battleFx = { popups: [], particles: [], slash: 0 });
  fx.popups.push({ x, y, value, crit, color, t: 0 });
}

function spawnSlash(scene) {
  const fx = scene.board.battleFx || (scene.board.battleFx = { popups: [], particles: [], slash: 0 });
  fx.slash = 0.16;
}

function spawnSoulParticles(scene, x, y) {
  const fx = scene.board.battleFx || (scene.board.battleFx = { popups: [], particles: [], slash: 0 });
  for (let i = 0; i < 10; i += 1) fx.particles.push({ x, y, vx: Phaser.Math.Between(-42, 42), vy: Phaser.Math.Between(-130, -70), t: 0 });
}

function renderBattleFx(scene, c) {
  const fx = scene.board.battleFx || { popups: [], particles: [], slash: 0 };
  if (fx.slash > 0) {
    const g = scene.add.graphics().setDepth(75);
    g.lineStyle(4, 0xffffff, fx.slash / 0.16);
    g.lineBetween(345, 225, 458, 318);
    c.add(g);
  }
  fx.popups.forEach((p) => {
    const a = Math.max(0, 1 - p.t / 0.7);
    const t = addText(scene, c, p.x, p.y - p.t * 70, `${p.crit ? "CRIT " : ""}-${p.value}`, p.crit ? 25 : 18, p.crit ? "#ffd76a" : p.color, 76).setOrigin(0.5);
    t.setAlpha(a);
  });
  fx.particles.forEach((p) => {
    const x = p.x + p.vx * p.t;
    const y = p.y + p.vy * p.t + 150 * p.t * p.t;
    const dot = scene.add.circle(x, y, 4, 0xf0c45c, Math.max(0, 1 - p.t / 0.9)).setDepth(74);
    c.add(dot);
  });
}

function signedAmount(label, value) {
  if (value > 0) return `${label} +${value}`;
  if (value < 0) return `${label} ${value}`;
  return `${label} 0`;
}

function patrolSummary(run) {
  const r = run.rewards;
  return [
    "이번 순찰 결과",
    `${signedAmount("Soul", r.soul)}   ${signedAmount("악명", r.notoriety)}`,
    `${signedAmount("세대수", r.monsters)}   ${signedAmount("관심도", r.clues)}`,
    `${signedAmount("EXP", r.exp)}   ${signedAmount("레벨업", r.levelUps)}`,
  ];
}

function finishPatrol(scene) {
  const run = scene.board.exploreRun;
  if (run?.boss) { run.boss.hp = run.boss.maxHp; run.boss.status = "대기"; }
  scene.board.step = "main";
  scene.board.tab = "explore";
  scene.board.exploreRun = null;
  scene.board.typewriter = null;
  renderBoard(scene);
}

function startBoardBattle(scene, event = null) {
  if (event && event.kind !== "hero") {
    scene.board.step = scene.board.exploreRun ? "exploreRun" : "main";
    renderBoard(scene);
    return;
  }
  const boss = getPatrolBoss(scene) || scene.board.bosses[0];
  const fallback = codexData().jobs[0] || { id: 101, n: "용사", hp: 60, at: 9 };
  const enemy = event?.entityId ? codexById(event.entityId) : fallback;
  const enemyName = event?.entityName || enemy?.n || "침입자";
  const enemyHp = Math.max(40, enemy?.hp || 60);
  const enemyAtk = Math.max(6, enemy?.at || 9);
  scene.board.step = "battle";
  scene.board.invasion = false;
  scene.board.powerUsed = false;
  scene.board.battle = {
    timer: 0,
    bossName: boss.name, bossCodexId: boss.codexId, bossHp: boss.hp, bossMax: boss.maxHp, bossAtk: boss.atk, bossLag: 1, bossHurt: 0,
    heroName: enemyName, heroCodexId: enemy?.id || fallback.id, heroHp: enemyHp, heroMax: enemyHp, heroAtk: enemyAtk, heroLag: 1, heroHurt: 0,
    result: null,
  };
  scene.board.logs.unshift(`${enemyName}와 전투가 시작됐다.`);
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

function exploreArea(scene, idx, redraw = true) {
  const area = scene.board.areas[idx];
  area.progress = Math.min(area.max, area.progress + 1);
  scene.board.dungeon.soul += 35;
  scene.board.logs.unshift(`${area.name} 순찰 완료. Soul +35`);
  if (idx === 0 && area.progress >= area.max && !scene.board.bosses[1].recruited) {
    scene.board.bosses[1].recruited = true;
    scene.board.bosses[1].status = "상주";
    scene.board.ownedMonsterIds?.add?.(scene.board.bosses[1].codexId);
    scene.board.dungeon.bosses += 1;
    scene.board.logs.unshift("새 필드보스 외눈박이 그룸을 영입했다.");
  }
  if (redraw) renderBoard(scene);
}

function expandDungeon(scene) {
  const d = scene.board.dungeon;
  if (d.stage === 0 && d.soul >= 180) { d.stage = 1; d.area = 42; d.households = 4; d.capacity = 32; d.asset = 2400; d.soul -= 180; scene.board.logs.unshift("던전을 42평으로 확장했다."); }
  else if (d.stage === 1 && d.soul >= 360) { d.stage = 2; d.area = 84; d.floor = "B2F"; d.households = 8; d.capacity = 56; d.asset = 5200; d.soul -= 360; scene.board.logs.unshift("B2F를 열고 84평으로 확장했다."); }
  else scene.board.logs.unshift("확장에 필요한 Soul이 부족하다.");
  renderBoard(scene);
}

function addBossIcon(scene, c, boss, x, y) {
  const scale = { slime: 1.5, vampire: 1.15, skeleton1: 1.15, skeleton2: 1.15, chest: 1.05, torch: 0.9, peaks: 0.9, imp: 1.6 }[boss.art] || 1.3;
  const img = addBossArt(scene, c, boss, x, y, scale);
  img?.setDisplaySize(Math.min(img.displayWidth, 34), Math.min(img.displayHeight, 34));
  return img;
}

function addBossArt(scene, c, boss, x, y, scale = 2) {
  if (boss.art === "slime") return addBoardSlime(scene, c, x, y, scale);
  if (boss.art === "vampire") return addBoardSprite(scene, c, "pdVampire", x, y, scale, { x: 0, y: 0, w: 32, h: 32 });
  if (boss.art === "skeleton1") return addBoardSprite(scene, c, "pdSkeleton", x, y, scale, { x: 0, y: 0, w: 32, h: 32 });
  if (boss.art === "skeleton2") return addBoardSprite(scene, c, "pdSkeleton", x, y, scale, { x: 32, y: 0, w: 32, h: 32 });
  if (boss.art === "chest") return addBoardSprite(scene, c, "pdChest", x, y, scale * 0.8);
  if (boss.art === "torch") return addBoardSprite(scene, c, "pdTorch", x, y, scale * 0.9);
  if (boss.art === "peaks") return addBoardSprite(scene, c, "pdPeaks", x, y, scale * 0.9);
  return addBoardSprite(scene, c, "pdCharacters", x, y, scale, { x: 16, y: 0, w: 16, h: 16 });
}

function addBoardSprite(scene, c, key, x, y, scale = 1, crop = null, alpha = 1) {
  const img = scene.add.image(x, y, key).setDepth(62).setScale(scale).setAlpha(alpha);
  if (crop) img.setCrop(crop.x, crop.y, crop.w, crop.h);
  c.add(img);
  return img;
}

function addBoardSlime(scene, c, x, y, scale = 2) {
  // ponytail: crop uses the first 16x16 character cell; replace with exact exported slime sprite when available.
  return addBoardSprite(scene, c, "pdCharacters", x, y, scale, { x: 0, y: 0, w: 16, h: 16 });
}

function addRect(scene, c, x, y, w, h, fill, alpha = 1, stroke = null, depth = 60) {
  const r = scene.add.rectangle(x, y, w, h, fill, alpha).setOrigin(0).setDepth(depth);
  if (stroke !== null) r.setStrokeStyle(1, stroke, 1);
  c.add(r); return r;
}


function addRexButton(scene, x, y, w, h, label, fn) {
  if (!scene.rexUI) return null;
  const button = scene.rexUI.add.label({
    x, y, width: w, height: h,
    background: scene.rexUI.add.roundRectangle(0, 0, 0, 0, 8, 0x1c2118).setStrokeStyle(3, UI_THEME.borderHot),
    text: scene.add.text(0, 0, label, {
      fontFamily: "system-ui, sans-serif",
      fontSize: "26px",
      fontStyle: "800",
      color: UI_THEME.gold,
      stroke: "#050606",
      strokeThickness: 3,
    }),
    align: "center",
    space: { left: 24, right: 24, top: 18, bottom: 18 },
  }).setDepth(43).layout().setInteractive({ useHandCursor: true });
  button.on("pointerdown", fn);
  return button;
}

function addPager(scene, c, y, page, total, setPage) {
  const max = Math.max(1, total || 1);
  const current = Phaser.Math.Clamp(page || 0, 0, max - 1);
  addButton(scene, c, 48, y, 120, 48, "이전", () => setPage(Math.max(0, current - 1)), current > 0 ? "default" : "disabled");
  addRect(scene, c, 208, y, 124, 48, 0x0d1110, 1, 0x32382f);
  addText(scene, c, 270, y + 24, `${current + 1}/${max}`, 16, "#c9c2b8").setOrigin(0.5);
  addButton(scene, c, 372, y, 120, 48, "다음", () => setPage(Math.min(max - 1, current + 1)), current < max - 1 ? "default" : "disabled");
}

function addText(scene, c, x, y, value, size, color = "#f4f1e8", depth = 61) {
  const t = scene.add.text(x, y, value, { fontFamily: "system-ui, sans-serif", fontSize: `${size}px`, fontStyle: "800", color, stroke: "#050606", strokeThickness: 3 }).setDepth(depth);
  c.add(t); return t;
}

function addButton(scene, c, x, y, w, h, label, fn, kind = "default", depth = 60) {
  const styles = {
    default: [UI_THEME.panel2, UI_THEME.border, UI_THEME.ink],
    primary: [0x1d2a27, UI_THEME.borderHot, UI_THEME.gold],
    danger: [0x351615, 0x8b4037, "#e6b3a8"],
    growth: [0x1b2418, UI_THEME.borderHot, UI_THEME.gold],
    explore: [0x182422, 0x5d7f70, "#cfe6d0"],
    power: [0x241b2a, 0x7b658c, "#ded0e8"],
    disabled: [0x171717, 0x333333, "#777777"],
    tab: [0x10130f, 0x32382f, UI_THEME.muted],
    tabActive: [0x1b2418, UI_THEME.borderHot, UI_THEME.gold],
  };
  const [fill, stroke, color] = styles[kind] || styles.default;
  const r = addRect(scene, c, x, y, w, h, fill, 1, stroke, depth).setInteractive({ useHandCursor: kind !== "disabled" });
  const t = addText(scene, c, x + w / 2, y + h / 2, label, 16, color, depth + 1).setOrigin(0.5);
  if (kind !== "disabled") { r.on("pointerdown", fn); t.setInteractive({ useHandCursor: true }).on("pointerdown", fn); }
  return r;
}

function logColor(line, i) {
  if (i === 0 && line === "이번 순찰 결과") return "#f4f1e8";
  if (line.includes("Soul")) return "#f0c45c";
  if (line.includes("악명")) return "#d68cff";
  if (line.includes("세대수")) return "#8cff7a";
  if (line.includes("관심도") || line.includes("필드보스")) return "#7fd8ff";
  if (line.includes("HP") || line.includes("체력") || line.includes("용사")) return "#ff8a7a";
  if (line.includes("아무것도 없다")) return "#8c9490";
  if (line.includes("떠돌이 몬스터")) return "#9cff8a";
  if (line.includes("자원")) return "#f0c45c";
  return "#c9c2b8";
}

function addLogPanel(scene, c, x, y, w, h, lines) {
  addRect(scene, c, x, y, w, h, 0x0c0f0e, 1, 0x29312e);
  lines.forEach((line, i) => addText(scene, c, x + 16, y + 16 + i * 26, line, i === 0 && line === "이번 순찰 결과" ? 17 : 14, logColor(line, i)));
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

function addMiniHp(scene, c, x, y, w, hp, maxHp) {
  const ratio = Phaser.Math.Clamp(hp / Math.max(1, maxHp), 0, 1);
  addText(scene, c, x, y - 18, `HP ${hp}/${maxHp}`, 12, "#f4f1e8");
  addRect(scene, c, x, y, w, 12, 0x161816, 1, 0x3c4540);
  addRect(scene, c, x, y, w * ratio, 12, ratio > 0.35 ? 0x54c845 : 0xd8483a, 1);
}

function drawHp(scene, c, x, y, w, ratio, lagOrName, nameOrValue, valueOrHurt, maybeHurt = 0) {
  const hasLag = typeof lagOrName === "number";
  const lag = hasLag ? lagOrName : ratio;
  const name = hasLag ? nameOrValue : lagOrName;
  const value = hasLag ? valueOrHurt : nameOrValue;
  const hurt = hasLag ? maybeHurt : 0;
  const flash = hurt > 0 && Math.floor(hurt * 40) % 2 === 0;
  addText(scene, c, x, y - 28, name, 15, flash ? "#ffb2a8" : "#f4f1e8");
  addRect(scene, c, x, y, w, 13, flash ? 0x4a1111 : 0x1a1a18, 1, 0x3c4540);
  addRect(scene, c, x, y, w * Math.max(0, lag), 13, flash ? 0xff9b2f : 0xf0b24b, 1);
  addRect(scene, c, x, y, w * Math.max(0, ratio), 13, ratio > 0.35 ? 0x54c845 : 0xd8483a, 1);
  addText(scene, c, x, y + 19, value, 14, "#c9c2b8");
}
