import Phaser from "phaser";
import { socket } from "../network";
import type { GameState, PlayerState, InputPayload, BulletState, DraftState, RoundResultState, AugmentTier, AugmentId, TeamState, RoundMatchup } from "@arenaz/types";
import { PLAYER_RADIUS, BULLET_RADIUS, MAP_WIDTH, MAP_HEIGHT, MAX_ROUNDS, FFA_TEAM_COLORS } from "@arenaz/types/src/constants";

// ── Palette ──
const BG_COLOR = 0x0f1123;
const GRID_LINE = 0x1a1f3a; const GRID_DOT = 0x252b4a; const GRID_SIZE = 64;
const WALL_FILL = 0x2a3050; const WALL_HIGHLIGHT = 0x3d4670; const WALL_SHADOW = 0x1a2040;
const HUD_BG = 0x1e2340; const HUD_BORDER = 0x2a3460;
const BULLET_WHITE = 0xffffff; const BULLET_BOUNCE = 0xff8800;
const HP_BAR_W = 44; const HP_BAR_H = 6; const LOGICAL_HEIGHT = 720;
const CORAL_HEX = "#ff6b4a";

const TIER_COLORS: Record<AugmentTier, { fill: number; hex: string }> = {
  Silver: { fill: 0xcccccc, hex: "#cccccc" },
  Gold: { fill: 0xffd700, hex: "#ffd700" },
  Prismatic: { fill: 0xaa55ff, hex: "#aa55ff" },
};

export class GameScene extends Phaser.Scene {
  private gameState: GameState | null = null;
  private currentPhase: "draft" | "combat" | "roundResult" | "waiting" = "waiting";

  private keys!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private shooting = false;

  private floorGraphics!: Phaser.GameObjects.Graphics;
  private wallsGraphics!: Phaser.GameObjects.Graphics;
  private gameGraphics!: Phaser.GameObjects.Graphics;
  private wallsDrawn = false;
  private cameraTarget!: Phaser.GameObjects.Rectangle;

  private hudCamera!: Phaser.Cameras.Scene2D.Camera;
  private hudContainer!: Phaser.GameObjects.Container;
  private hudGfx!: Phaser.GameObjects.Graphics;
  private timerText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private myStatsText!: Phaser.GameObjects.Text;
  private killFeedText!: Phaser.GameObjects.Text;
  private deathText!: Phaser.GameObjects.Text;

  private draftOverlay: Phaser.GameObjects.Container | null = null;
  private resultOverlay: Phaser.GameObjects.Container | null = null;

  private tabKey!: Phaser.Input.Keyboard.Key;
  private scoreboardContainer: Phaser.GameObjects.Container | null = null;

  private bulletTrails: Map<string, { x: number; y: number }[]> = new Map();
  private cachedWalls: GameState["walls"] | null = null;
  private renderPos: Map<string, { x: number; y: number }> = new Map();
  private nameTags: Map<string, Phaser.GameObjects.Text> = new Map();
  private _statsText: Phaser.GameObjects.Text | null = null;

  constructor() { super({ key: "GameScene" }); }
  private get sw(): number { return this.scale.width; }
  private get sh(): number { return this.scale.height; }

  create() {
    this.cameras.main.setBackgroundColor(BG_COLOR);
    this.cameras.main.setZoom(this.scale.height / LOGICAL_HEIGHT);
    this.cameraTarget = this.add.rectangle(0, 0, 1, 1, 0x000000, 0);
    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
    this.cameras.main.startFollow(this.cameraTarget, true, 1, 1);

    this.floorGraphics = this.add.graphics();
    this.wallsGraphics = this.add.graphics();
    this.gameGraphics = this.add.graphics();

    this.hudCamera = this.cameras.add(0, 0, this.sw, this.sh);
    this.hudCamera.setScroll(0, 0).setZoom(1);
    this.hudCamera.transparent = true;
    this.hudContainer = this.add.container(0, 0).setDepth(1000);
    this.hudGfx = this.add.graphics().setDepth(1000);
    this.hudContainer.add(this.hudGfx);
    this.cameras.main.ignore([this.hudContainer, this.hudGfx]);
    this.hudCamera.ignore([this.floorGraphics, this.wallsGraphics, this.gameGraphics, this.cameraTarget]);

    const addHud = (size: string, color: string, bold = false) => {
      const t = this.add.text(0, 0, "", { fontSize: size, color, fontStyle: bold ? "bold" : "normal" }).setDepth(1000);
      this.hudContainer.add(t); this.cameras.main.ignore(t); return t;
    };
    this.timerText = addHud("22px", "#ffffff", true).setOrigin(0.5, 0);
    this.myStatsText = addHud("14px", "#cccccc").setOrigin(0.5, 0);
    this.scoreText = addHud("14px", "#cccccc");
    this.killFeedText = addHud("13px", "#dddddd").setOrigin(1, 0);
    this.deathText = addHud("36px", "#ff4444", true).setOrigin(0.5).setVisible(false);

    this.tabKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
    this.keys = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.input.on("pointerdown", () => { if (this.currentPhase === "combat") this.shooting = true; });
    this.input.on("pointerup", () => { this.shooting = false; });

    this.scale.on("resize", (size: Phaser.Structs.Size) => {
      this.cameras.main.setZoom(size.height / LOGICAL_HEIGHT);
      this.hudCamera.setSize(size.width, size.height);
    });

    socket.on("gameState", (state) => {
      if (state.walls.length > 0) this.cachedWalls = state.walls;
      if (this.cachedWalls) state.walls = this.cachedWalls;
      this.gameState = state; this.currentPhase = "combat";
      this.hideDraftOverlay(); this.hideResultOverlay();
    });
    socket.on("draftState", (state) => { this.currentPhase = "draft"; this.showDraftOverlay(state); });
    socket.on("roundResult", (state) => { this.currentPhase = "roundResult"; this.hideDraftOverlay(); this.showResultOverlay(state); });
    socket.on("gameOver", (data) => { this.scene.start("GameOverScene", { data }); });
  }

  update() {
    if (this.currentPhase === "combat" && this.gameState) { this.sendInput(); this.renderGame(); }
    this.renderHUD();
  }

  private sendInput(): void {
    const me = this.getMe(); if (!me) return;
    const dx = (this.keys.D.isDown ? 1 : 0) - (this.keys.A.isDown ? 1 : 0);
    const dy = (this.keys.S.isDown ? 1 : 0) - (this.keys.W.isDown ? 1 : 0);
    const wp = this.cameras.main.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y);
    socket.emit("input", { dx, dy, aimAngle: Math.atan2(wp.y - me.y, wp.x - me.x), shoot: this.shooting });
  }

  // ── Draft overlay ──
  private showDraftOverlay(state: DraftState): void {
    this.hideDraftOverlay();
    const w = this.sw; const h = this.sh;
    this.draftOverlay = this.add.container(0, 0).setDepth(2000);
    this.cameras.main.ignore(this.draftOverlay);
    const bg = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.75);
    this.draftOverlay.add(bg); this.cameras.main.ignore(bg);
    const tierColor = TIER_COLORS[state.tier];
    const addT = (x: number, y: number, text: string, opts: Phaser.Types.GameObjects.Text.TextStyle) => {
      const t = this.add.text(x, y, text, opts); this.draftOverlay!.add(t); this.cameras.main.ignore(t); return t;
    };
    addT(w / 2, 40, `ROUND ${state.roundNumber}`, { fontSize: "24px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5);
    addT(w / 2, 70, `${state.tier.toUpperCase()} AUGMENTS`, { fontSize: "14px", color: tierColor.hex, fontStyle: "bold" }).setOrigin(0.5);
    addT(w / 2, h - 70, `${Math.ceil(state.timerMs / 1000)}s`, { fontSize: "20px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5);

    const cardW = 180; const cardH = 260; const gap = 24;
    const totalW = state.cards.length * cardW + (state.cards.length - 1) * gap;
    const startX = w / 2 - totalW / 2 + cardW / 2;
    const mySelection = state.selections[socket.id ?? ""];

    state.cards.forEach((card, i) => {
      const cx = startX + i * (cardW + gap); const cy = h / 2 - 20;
      const isSelected = mySelection === card.id;
      const cg = this.add.graphics();
      cg.fillStyle(0x12131f, 1); cg.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 12);
      cg.lineStyle(isSelected ? 3 : 2, tierColor.fill, isSelected ? 1 : 0.6);
      cg.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 12);
      if (isSelected) { cg.fillStyle(tierColor.fill, 0.1); cg.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 12); }
      this.draftOverlay!.add(cg); this.cameras.main.ignore(cg);

      addT(cx, cy - 20, card.name, { fontSize: "16px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5);
      addT(cx, cy + 20, card.description, { fontSize: "12px", color: "#aaaacc", wordWrap: { width: cardW - 24 }, align: "center" }).setOrigin(0.5, 0);
      if (isSelected) addT(cx, cy + cardH / 2 - 30, "SELECTED", { fontSize: "12px", color: tierColor.hex, fontStyle: "bold" }).setOrigin(0.5);

      if (!mySelection) {
        const hit = this.add.rectangle(cx, cy, cardW, cardH, 0, 0).setInteractive({ useHandCursor: true });
        hit.on("pointerdown", () => socket.emit("selectAugment", card.id));
        this.draftOverlay!.add(hit); this.cameras.main.ignore(hit);
      }

      // Per-card reroll
      const rerolls = state.cardRerolls[i] ?? 0;
      if (rerolls > 0 && !mySelection) {
        const rrY = cy + cardH / 2 + 18;
        const rg = this.add.graphics();
        rg.fillStyle(HUD_BG, 1); rg.fillRoundedRect(cx - 50, rrY - 12, 100, 24, 12);
        this.draftOverlay!.add(rg); this.cameras.main.ignore(rg);
        addT(cx, rrY, `Reroll (${rerolls})`, { fontSize: "11px", color: CORAL_HEX, fontStyle: "bold" }).setOrigin(0.5);
        const rh = this.add.rectangle(cx, rrY, 100, 24, 0, 0).setInteractive({ useHandCursor: true });
        rh.on("pointerdown", () => socket.emit("rerollDraft", i));
        this.draftOverlay!.add(rh); this.cameras.main.ignore(rh);
      }
    });
  }
  private hideDraftOverlay(): void { if (this.draftOverlay) { this.draftOverlay.destroy(); this.draftOverlay = null; } }

  // ── Round result overlay ──
  private showResultOverlay(state: RoundResultState): void {
    this.hideResultOverlay();
    const w = this.sw; const h = this.sh;
    this.resultOverlay = this.add.container(0, 0).setDepth(2000);
    this.cameras.main.ignore(this.resultOverlay);
    const bg = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.75);
    this.resultOverlay.add(bg); this.cameras.main.ignore(bg);
    const addT = (x: number, y: number, text: string, opts: Phaser.Types.GameObjects.Text.TextStyle) => {
      const t = this.add.text(x, y, text, opts); this.resultOverlay!.add(t); this.cameras.main.ignore(t); return t;
    };
    addT(w / 2, h / 2 - 100, `ROUND ${state.roundNumber} COMPLETE`, { fontSize: "28px", color: CORAL_HEX, fontStyle: "bold" }).setOrigin(0.5);

    // Show team health changes
    let y = h / 2 - 50;
    const teamNums = Object.keys(state.teamHealths).map(Number).sort((a, b) => a - b);
    for (const tn of teamNums) {
      const hp = state.teamHealths[tn];
      const change = state.teamHealthChanges[tn] ?? 0;
      const eliminated = state.eliminations.includes(tn);
      const color = eliminated ? "#ff4444" : change < 0 ? "#ffaa00" : "#44ff44";
      const changeStr = change < 0 ? ` (${change})` : "";
      addT(w / 2, y, `Team ${tn}: ${hp} HP${changeStr}${eliminated ? " ELIMINATED" : ""}`, { fontSize: "15px", color }).setOrigin(0.5);
      y += 24;
    }
  }
  private hideResultOverlay(): void { if (this.resultOverlay) { this.resultOverlay.destroy(); this.resultOverlay = null; } }

  // ── World rendering ──
  private renderGame(): void {
    const state = this.gameState!;
    if (!this.wallsDrawn) { this.drawFloor(); this.drawWalls(state); this.wallsDrawn = true; }
    this.gameGraphics.clear();

    const me = this.getMe();
    if (me) { this.cameraTarget.setPosition(me.x, me.y); this.deathText.setVisible(!me.alive); if (!me.alive) this.deathText.setText("ELIMINATED"); }

    this.updateBulletTrails(state.bullets);
    for (const b of state.bullets) this.drawBullet(b);

    // Interpolate + draw players
    for (const p of state.players) {
      let rp = this.renderPos.get(p.id);
      if (!rp) { rp = { x: p.x, y: p.y }; this.renderPos.set(p.id, rp); }
      if (p.id === socket.id || !p.alive) { rp.x = p.x; rp.y = p.y; }
      else { rp.x = Phaser.Math.Linear(rp.x, p.x, 0.3); rp.y = Phaser.Math.Linear(rp.y, p.y, 0.3); }
      this.drawPlayer(p, rp.x, rp.y);
    }
    const pIds = new Set(state.players.map((p) => p.id));
    for (const id of this.renderPos.keys()) if (!pIds.has(id)) this.renderPos.delete(id);

    // Nametags
    for (const [id, tag] of this.nameTags.entries()) { if (!pIds.has(id)) { tag.destroy(); this.nameTags.delete(id); } }
    for (const p of state.players) {
      if (!p.alive) { this.nameTags.get(p.id)?.setVisible(false); continue; }
      let tag = this.nameTags.get(p.id);
      if (!tag) { tag = this.add.text(0, 0, "", { fontSize: "11px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5).setDepth(50); this.hudCamera.ignore(tag); this.nameTags.set(p.id, tag); }
      const rp = this.renderPos.get(p.id) ?? { x: p.x, y: p.y };
      tag.setPosition(rp.x, rp.y - (p.playerRadius || PLAYER_RADIUS) - 24);
      tag.setText(p.name); tag.setVisible(true);
      const teamColor = getTeamColor(p.team);
      tag.setColor(p.id === socket.id ? CORAL_HEX : `#${teamColor.toString(16).padStart(6, "0")}`);
    }
  }

  private drawFloor(): void {
    const g = this.floorGraphics; g.clear();
    g.lineStyle(1, GRID_LINE, 0.4);
    for (let x = 0; x <= MAP_WIDTH; x += GRID_SIZE) g.lineBetween(x, 0, x, MAP_HEIGHT);
    for (let y = 0; y <= MAP_HEIGHT; y += GRID_SIZE) g.lineBetween(0, y, MAP_WIDTH, y);
    g.fillStyle(GRID_DOT, 0.6);
    for (let x = 0; x <= MAP_WIDTH; x += GRID_SIZE) for (let y = 0; y <= MAP_HEIGHT; y += GRID_SIZE) g.fillCircle(x, y, 1.5);
  }

  private drawWalls(state: GameState): void {
    const g = this.wallsGraphics; g.clear();
    for (const wall of state.walls) {
      const { x, y, w, h } = wall;
      g.fillStyle(0x080a18, 0.6); g.fillRoundedRect(x + 3, y + 3, w, h, 3);
      g.fillStyle(WALL_FILL, 1); g.fillRoundedRect(x, y, w, h, 3);
      g.fillStyle(WALL_HIGHLIGHT, 1); g.fillRect(x + 3, y, w - 6, 2); g.fillRect(x, y + 3, 2, h - 6);
      g.fillStyle(WALL_SHADOW, 1); g.fillRect(x + 3, y + h - 2, w - 6, 2); g.fillRect(x + w - 2, y + 3, 2, h - 6);
    }
  }

  private updateBulletTrails(bullets: BulletState[]): void {
    const ids = new Set(bullets.map((b) => b.id));
    for (const id of this.bulletTrails.keys()) if (!ids.has(id)) this.bulletTrails.delete(id);
    for (const b of bullets) {
      let t = this.bulletTrails.get(b.id);
      if (!t) { t = []; this.bulletTrails.set(b.id, t); }
      t.push({ x: b.x, y: b.y }); while (t.length > (b.bouncesRemaining > 0 ? 5 : 3)) t.shift();
    }
  }

  private drawBullet(b: BulletState): void {
    const g = this.gameGraphics;
    const color = b.bouncesRemaining > 0 ? BULLET_BOUNCE : BULLET_WHITE;
    const trail = this.bulletTrails.get(b.id);
    if (trail) for (let i = 0; i < trail.length - 1; i++) {
      g.fillStyle(color, (i + 1) / trail.length * 0.4);
      g.fillCircle(trail[i].x, trail[i].y, BULLET_RADIUS * (0.4 + 0.6 * (i / trail.length)));
    }
    g.fillStyle(color, 0.1); g.fillCircle(b.x, b.y, BULLET_RADIUS + 6);
    g.fillStyle(color, 0.25); g.fillCircle(b.x, b.y, BULLET_RADIUS + 3);
    g.fillStyle(color, 1); g.fillCircle(b.x, b.y, BULLET_RADIUS + 1);
  }

  private drawPlayer(player: PlayerState, rx: number, ry: number): void {
    if (!player.alive) return;
    const g = this.gameGraphics;
    const R = player.playerRadius || PLAYER_RADIUS;
    const teamColor = getTeamColor(player.team);
    const isMe = player.id === socket.id;

    // Glow
    g.fillStyle(teamColor, isMe ? 0.12 : 0.06); g.fillCircle(rx, ry, R + 14);
    if (player.damageFlashMs > 0) { g.fillStyle(0xff0000, 0.4); g.fillCircle(rx, ry, R + 8); }
    if (player.onBye) { g.fillStyle(teamColor, 0.3); g.fillCircle(rx, ry, R); } // dimmed for bye
    else { g.fillStyle(teamColor, isMe ? 1 : 0.85); g.fillCircle(rx, ry, R); }
    g.fillStyle(0xffffff, 0.15); g.fillCircle(rx - 2, ry - 3, R * 0.45);

    // Outline
    g.lineStyle(isMe ? 3 : 2, teamColor, isMe ? 1 : 0.7); g.strokeCircle(rx, ry, R + 3);
    if (player.shieldGuardReady) { g.lineStyle(2.5, 0xaaaaff, 0.8); g.strokeCircle(rx, ry, R + 8); }
    if (player.burning) { g.fillStyle(0xff6600, 0.3); g.fillCircle(rx, ry, R + 6); }
    if (player.frozen || player.slowed) {
      g.lineStyle(2.5, player.frozen ? 0x4488ff : 0x44ff88, 0.55);
      const rot = Date.now() / 400;
      for (let i = 0; i < 6; i++) { const a = rot + (i / 6) * Math.PI * 2; g.beginPath(); g.arc(rx, ry, R + 5, a, a + Math.PI / 8); g.strokePath(); }
    }

    // Aim
    const angle = player.aimAngle; const aimR = R + 10;
    g.fillStyle(0xffffff, 0.85); g.beginPath();
    g.moveTo(rx + Math.cos(angle) * (aimR + 5), ry + Math.sin(angle) * (aimR + 5));
    g.lineTo(rx + Math.cos(angle - 0.35) * aimR, ry + Math.sin(angle - 0.35) * aimR);
    g.lineTo(rx + Math.cos(angle + 0.35) * aimR, ry + Math.sin(angle + 0.35) * aimR);
    g.closePath(); g.fillPath();

    // HP bar
    const hpPct = player.hp / player.maxHp;
    const bx = rx - HP_BAR_W / 2; const by = ry - R - 16;
    g.fillStyle(0x000000, 0.6); g.fillRoundedRect(bx - 2, by - 2, HP_BAR_W + 4, HP_BAR_H + 4, 4);
    g.fillStyle(0x1a1a2a, 1); g.fillRoundedRect(bx, by, HP_BAR_W, HP_BAR_H, 3);
    if (hpPct > 0) {
      g.fillStyle(hpPct > 0.6 ? 0x2ecc71 : hpPct > 0.3 ? 0xf39c12 : 0xe74c3c, 1);
      g.fillRoundedRect(bx, by, HP_BAR_W * hpPct, HP_BAR_H, 3);
    }
  }

  // ── HUD ──
  private renderHUD(): void {
    this.hudGfx.clear();
    if (!this.gameState) return;
    const state = this.gameState;
    const w = this.sw; const h = this.sh;
    const g = this.hudGfx;

    // Timer
    g.fillStyle(HUD_BG, 0.85); g.fillRoundedRect(w / 2 - 110, 8, 220, 56, 12);
    g.lineStyle(1, HUD_BORDER, 0.5); g.strokeRoundedRect(w / 2 - 110, 8, 220, 56, 12);
    const secs = Math.max(0, Math.ceil(state.timeRemainingMs / 1000));
    this.timerText.setPosition(w / 2, 14);
    this.timerText.setText(`R${state.roundNumber}  Lv${state.currentLevel}  ${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, "0")}`);

    const me = this.getMe();
    this.myStatsText.setPosition(w / 2, 40);
    if (me) { this.myStatsText.setText(`K:${me.kills} D:${me.deaths} DMG:${me.stats.attackDamage} HP:${me.stats.health}`); }

    // Team health bars (top left)
    const teams = state.teams.sort((a, b) => a.teamNumber - b.teamNumber);
    const thY = 12; const thW = 160; const thH = 16 + teams.length * 22;
    g.fillStyle(HUD_BG, 0.8); g.fillRoundedRect(10, thY, thW, thH, 8);
    teams.forEach((t, i) => {
      const ty = thY + 10 + i * 22;
      const barW = 80; const barPct = t.health / 100;
      g.fillStyle(t.color, t.eliminated ? 0.2 : 0.8); g.fillCircle(22, ty + 5, 5);
      g.fillStyle(0x111111, 0.8); g.fillRoundedRect(34, ty, barW, 10, 3);
      if (barPct > 0) { g.fillStyle(t.color, t.eliminated ? 0.3 : 1); g.fillRoundedRect(34, ty, barW * barPct, 10, 3); }
    });
    this.scoreText.setPosition(120, thY + 6);
    this.scoreText.setText(teams.map((t) => `${t.eliminated ? "X" : t.health}`).join("\n"));

    // Kill feed
    const kfLines = state.killFeed.length;
    if (kfLines > 0) { g.fillStyle(HUD_BG, 0.7); g.fillRoundedRect(w - 190, 10, 180, 10 + kfLines * 18, 8); }
    this.killFeedText.setPosition(w - 16, 14);
    this.killFeedText.setText(state.killFeed.map((e) => `${e.killerId.slice(0, 6)} > ${e.victimId.slice(0, 6)}`).join("\n"));

    this.deathText.setPosition(w / 2, h / 2);

    // TAB scoreboard
    if (this.tabKey.isDown) this.showScoreboard(state);
    else if (this.scoreboardContainer) { this.scoreboardContainer.destroy(); this.scoreboardContainer = null; }
  }

  private showScoreboard(state: GameState): void {
    if (this.scoreboardContainer) this.scoreboardContainer.destroy();
    const w = this.sw; const h = this.sh;
    this.scoreboardContainer = this.add.container(0, 0).setDepth(1500);
    this.cameras.main.ignore(this.scoreboardContainer);
    const pw = 400; const px = w / 2;
    this.scoreboardContainer.add(this.add.rectangle(px, h / 2, pw, h * 0.6, 0x000000, 0.85));
    let y = h * 0.2;
    const addT = (x: number, text: string, opts: Phaser.Types.GameObjects.Text.TextStyle) => {
      const t = this.add.text(x, y, text, opts); this.scoreboardContainer!.add(t); this.cameras.main.ignore(t);
    };
    const c1 = px - pw / 2 + 16; const c2 = c1 + 60; const c3 = c2 + 120; const c4 = c3 + 50;
    const hdr = { fontSize: "11px", color: "#888", fontStyle: "bold" as const };
    addT(c1, "TEAM", hdr); addT(c2, "PLAYER", hdr); addT(c3, "K/D", hdr); addT(c4, "DMG", hdr); y += 18;
    for (const p of [...state.players].sort((a, b) => b.kills - a.kills)) {
      const im = p.id === socket.id;
      const s = { fontSize: "13px", color: im ? "#ffffff" : "#cccccc", fontStyle: im ? "bold" as const : "normal" as const };
      addT(c1, String(p.team), s); addT(c2, p.name, s); addT(c3, `${p.kills}/${p.deaths}`, s); addT(c4, String(p.damageDealt), s); y += 18;
    }
  }

  private getMe(): PlayerState | undefined { return this.gameState?.players.find((p) => p.id === socket.id); }

  shutdown() {
    this.hideDraftOverlay(); this.hideResultOverlay();
    if (this.scoreboardContainer) { this.scoreboardContainer.destroy(); this.scoreboardContainer = null; }
    this.bulletTrails.clear(); this.renderPos.clear();
    for (const tag of this.nameTags.values()) tag.destroy(); this.nameTags.clear();
    if (this.hudCamera) this.cameras.remove(this.hudCamera);
    socket.off("gameState"); socket.off("draftState"); socket.off("roundResult"); socket.off("gameOver");
    this.input.off("pointerdown"); this.input.off("pointerup"); this.scale.off("resize");
  }
}

function getTeamColor(team: number): number {
  return FFA_TEAM_COLORS[(team - 1) % FFA_TEAM_COLORS.length] ?? 0xffffff;
}
