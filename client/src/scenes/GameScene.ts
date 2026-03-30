import Phaser from "phaser";
import { socket } from "../network";
import type { GameState, PlayerState, InputPayload, CharacterType, BulletState, DraftState, RoundResultState, AugmentTier, AugmentId } from "@arenaz/types";
import {
  PLAYER_RADIUS,
  BULLET_RADIUS,
  MAP_WIDTH,
  MAP_HEIGHT,
  TOTAL_ROUNDS,
} from "@arenaz/types/src/constants";

// ── Visual palette ──
const BG_COLOR = 0x0f1123;
const GRID_LINE = 0x1a1f3a;
const GRID_DOT = 0x252b4a;
const GRID_SIZE = 64;

const WALL_FILL = 0x2a3050;
const WALL_HIGHLIGHT = 0x3d4670;
const WALL_SHADOW = 0x1a2040;

const HUD_BG = 0x1e2340;
const HUD_BORDER = 0x2a3460;

const BULLET_WHITE = 0xffffff;
const BULLET_BOUNCE = 0xff8800;
const GRENADE_COLOR = 0x44ff88;

const CORAL = 0xff6b4a;
const CORAL_HEX = "#ff6b4a";
const GOLD = 0xffd700;
const GOLD_HEX = "#ffd700";
const PRISMATIC = 0xaa55ff;
const PRISMATIC_HEX = "#aa55ff";
const SILVER = 0xcccccc;
const SILVER_HEX = "#cccccc";

const HP_BAR_W = 44;
const HP_BAR_H = 6;
const LOGICAL_HEIGHT = 720;

const CHARACTER_COLORS: Record<string, number> = {
  Bruiser: 0xe74c3c, Phantom: 0x9b59b6, Warden: 0x2ecc71,
};
const TEAM_COLORS: Record<number, number> = {
  0: 0xffffff, 1: 0xe74c3c, 2: 0x3498db,
};

const TIER_COLORS: Record<AugmentTier, { fill: number; hex: string }> = {
  Silver: { fill: SILVER, hex: SILVER_HEX },
  Gold: { fill: GOLD, hex: GOLD_HEX },
  Prismatic: { fill: PRISMATIC, hex: PRISMATIC_HEX },
};

const CHARACTER_INFO: Record<CharacterType, { color: string; active: string; passive: string }> = {
  Bruiser: { color: "#e74c3c", active: "Shield Bash — Knockback nearby enemies", passive: "15% less damage below 40% HP" },
  Phantom: { color: "#9b59b6", active: "Blink — Teleport in move direction", passive: "+50% damage on first shot after Blink" },
  Warden: { color: "#2ecc71", active: "Pulse Grenade — AoE slow zone", passive: "Heal 2 HP/s after 3s without damage" },
};

export class GameScene extends Phaser.Scene {
  private gameState: GameState | null = null;
  private currentPhase: "draft" | "combat" | "roundResult" | "waiting" = "waiting";

  private keys!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key; SPACE: Phaser.Input.Keyboard.Key };
  private shooting = false;

  // World graphics
  private floorGraphics!: Phaser.GameObjects.Graphics;
  private wallsGraphics!: Phaser.GameObjects.Graphics;
  private gameGraphics!: Phaser.GameObjects.Graphics;
  private wallsDrawn = false;
  private cameraTarget!: Phaser.GameObjects.Rectangle;

  // HUD (separate camera)
  private hudCamera!: Phaser.Cameras.Scene2D.Camera;
  private hudContainer!: Phaser.GameObjects.Container;
  private hudGfx!: Phaser.GameObjects.Graphics;
  private timerText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private myStatsText!: Phaser.GameObjects.Text;
  private cooldownText!: Phaser.GameObjects.Text;
  private deathText!: Phaser.GameObjects.Text;
  private killFeedText!: Phaser.GameObjects.Text;

  // Draft overlay
  private draftOverlay: Phaser.GameObjects.Container | null = null;
  private draftState: DraftState | null = null;

  // Round result overlay
  private resultOverlay: Phaser.GameObjects.Container | null = null;

  // Help
  private helpPanel: Phaser.GameObjects.Container | null = null;
  private helpBtnContainer: Phaser.GameObjects.Container | null = null;
  private helpOpen = false;

  // TAB
  private tabKey!: Phaser.Input.Keyboard.Key;
  private scoreboardContainer: Phaser.GameObjects.Container | null = null;

  // Bullets
  private bulletTrails: Map<string, { x: number; y: number }[]> = new Map();

  // Stats text (created once, updated per frame)
  private _statsText: Phaser.GameObjects.Text | null = null;

  // Nametag text objects (reused across frames)
  private nameTags: Map<string, Phaser.GameObjects.Text> = new Map();

  constructor() { super({ key: "GameScene" }); }

  private get sw(): number { return this.scale.width; }
  private get sh(): number { return this.scale.height; }

  create() {
    this.cameras.main.setBackgroundColor(BG_COLOR);
    this.applyZoom();

    this.cameraTarget = this.add.rectangle(0, 0, 1, 1, 0x000000, 0);
    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
    this.cameras.main.startFollow(this.cameraTarget, true, 1, 1);

    this.floorGraphics = this.add.graphics();
    this.wallsGraphics = this.add.graphics();
    this.gameGraphics = this.add.graphics();

    // HUD camera
    this.hudCamera = this.cameras.add(0, 0, this.sw, this.sh);
    this.hudCamera.setScroll(0, 0).setZoom(1);
    this.hudCamera.transparent = true;

    this.hudContainer = this.add.container(0, 0).setDepth(1000);
    this.hudGfx = this.add.graphics().setDepth(1000);
    this.hudContainer.add(this.hudGfx);
    this.cameras.main.ignore([this.hudContainer, this.hudGfx]);
    this.hudCamera.ignore([this.floorGraphics, this.wallsGraphics, this.gameGraphics, this.cameraTarget]);

    this.timerText = this.addHudText("22px", "#ffffff", true).setOrigin(0.5, 0);
    this.myStatsText = this.addHudText("15px", "#cccccc").setOrigin(0.5, 0);
    this.scoreText = this.addHudText("15px", "#cccccc");
    this.cooldownText = this.addHudText("16px", "#aaaaaa", true).setOrigin(0.5, 0.5);
    this.deathText = this.addHudText("36px", "#ff4444", true).setOrigin(0.5).setVisible(false);
    this.killFeedText = this.addHudText("14px", "#dddddd").setOrigin(1, 0);
    this.layoutHUD();

    this.tabKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
    this.keys = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      SPACE: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
    };
    this.input.on("pointerdown", () => { if (this.currentPhase === "combat") this.shooting = true; });
    this.input.on("pointerup", () => { this.shooting = false; });

    this.scale.on("resize", (size: Phaser.Structs.Size) => {
      this.applyZoom();
      this.hudCamera.setSize(size.width, size.height);
      this.layoutHUD();
    });

    this.buildHelpButton();

    // Socket events
    socket.on("gameState", (state) => {
      this.gameState = state;
      this.currentPhase = "combat";
      this.hideDraftOverlay();
      this.hideResultOverlay();
    });

    socket.on("draftState", (state) => {
      this.draftState = state;
      this.currentPhase = "draft";
      this.showDraftOverlay(state);
    });

    socket.on("roundResult", (state) => {
      this.currentPhase = "roundResult";
      this.hideDraftOverlay();
      this.showResultOverlay(state);
    });

    socket.on("gameOver", (data) => { this.scene.start("GameOverScene", { data }); });
  }

  private addHudText(size: string, color: string, bold = false): Phaser.GameObjects.Text {
    const t = this.add.text(0, 0, "", { fontSize: size, color, fontStyle: bold ? "bold" : "normal" }).setDepth(1000);
    this.hudContainer.add(t);
    this.cameras.main.ignore(t);
    return t;
  }

  private layoutHUD(): void {
    const w = this.sw; const h = this.sh; const pad = 16;
    this.timerText.setPosition(w / 2, pad + 4);
    this.myStatsText.setPosition(w / 2, pad + 30);
    this.scoreText.setPosition(pad + 8, pad + 8);
    this.killFeedText.setPosition(w - pad, pad + 8);
    this.cooldownText.setPosition(w / 2, h - 28);
    this.deathText.setPosition(w / 2, h / 2);
  }

  update() {
    if (this.currentPhase === "combat" && this.gameState) {
      this.sendInput();
      this.renderGame();
    }
    this.renderHUD();
  }

  private sendInput(): void {
    const me = this.getMe();
    if (!me) return;
    const dx = (this.keys.D.isDown ? 1 : 0) - (this.keys.A.isDown ? 1 : 0);
    const dy = (this.keys.S.isDown ? 1 : 0) - (this.keys.W.isDown ? 1 : 0);
    const pointer = this.input.activePointer;
    const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const aimAngle = Math.atan2(wp.y - me.y, wp.x - me.x);
    socket.emit("input", { dx, dy, aimAngle, shoot: this.shooting, ability: this.keys.SPACE.isDown });
  }

  // ══════════════════════════════════
  // ── DRAFT OVERLAY ──
  // ══════════════════════════════════

  private showDraftOverlay(state: DraftState): void {
    this.hideDraftOverlay();
    const w = this.sw; const h = this.sh;

    this.draftOverlay = this.add.container(0, 0).setDepth(2000);
    this.cameras.main.ignore(this.draftOverlay);

    // Dim backdrop
    const bg = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.75);
    this.draftOverlay.add(bg);
    this.cameras.main.ignore(bg);

    // Round title
    const tierColor = TIER_COLORS[state.tier];
    const title = this.add.text(w / 2, 40, `ROUND ${state.roundNumber} / ${TOTAL_ROUNDS}`, {
      fontSize: "24px", color: "#ffffff", fontStyle: "bold", fontFamily: "'Arial Black', Impact, sans-serif",
    }).setOrigin(0.5);
    this.draftOverlay.add(title);
    this.cameras.main.ignore(title);

    const subtitle = this.add.text(w / 2, 70, `${state.tier.toUpperCase()} AUGMENTS`, {
      fontSize: "14px", color: tierColor.hex, fontStyle: "bold",
    }).setOrigin(0.5);
    this.draftOverlay.add(subtitle);
    this.cameras.main.ignore(subtitle);

    // Timer
    const timerSecs = Math.ceil(state.timerMs / 1000);
    const timerT = this.add.text(w / 2, h - 80, `${timerSecs}s`, {
      fontSize: "20px", color: "#ffffff", fontStyle: "bold",
    }).setOrigin(0.5);
    this.draftOverlay.add(timerT);
    this.cameras.main.ignore(timerT);

    // 3 cards
    const cardW = 180; const cardH = 260; const gap = 24;
    const totalW = state.cards.length * cardW + (state.cards.length - 1) * gap;
    const startX = w / 2 - totalW / 2 + cardW / 2;

    const mySelection = state.selections[socket.id ?? ""];

    state.cards.forEach((card, i) => {
      const cx = startX + i * (cardW + gap);
      const cy = h / 2 - 20;
      const isSelected = mySelection === card.id;
      const someoneSelected = mySelection !== null && mySelection !== undefined;

      // Card background
      const cardGfx = this.add.graphics();
      cardGfx.fillStyle(0x12131f, 1);
      cardGfx.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 12);
      // Border — tier color, brighter if selected
      cardGfx.lineStyle(isSelected ? 3 : 2, tierColor.fill, isSelected ? 1 : 0.6);
      cardGfx.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 12);

      if (isSelected) {
        cardGfx.fillStyle(tierColor.fill, 0.1);
        cardGfx.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 12);
      }
      this.draftOverlay!.add(cardGfx);
      this.cameras.main.ignore(cardGfx);

      // Tier badge
      const badgeGfx = this.add.graphics();
      badgeGfx.fillStyle(tierColor.fill, 0.2);
      badgeGfx.fillRoundedRect(cx - 30, cy - cardH / 2 + 12, 60, 18, 9);
      this.draftOverlay!.add(badgeGfx);
      this.cameras.main.ignore(badgeGfx);

      const badgeText = this.add.text(cx, cy - cardH / 2 + 21, state.tier, {
        fontSize: "10px", color: tierColor.hex, fontStyle: "bold",
      }).setOrigin(0.5);
      this.draftOverlay!.add(badgeText);
      this.cameras.main.ignore(badgeText);

      // Augment name
      const nameT = this.add.text(cx, cy - 20, card.name, {
        fontSize: "16px", color: "#ffffff", fontStyle: "bold",
        fontFamily: "'Arial Black', Impact, sans-serif",
      }).setOrigin(0.5);
      this.draftOverlay!.add(nameT);
      this.cameras.main.ignore(nameT);

      // Description
      const descT = this.add.text(cx, cy + 20, card.description, {
        fontSize: "12px", color: "#aaaacc", wordWrap: { width: cardW - 24 }, align: "center",
      }).setOrigin(0.5, 0);
      this.draftOverlay!.add(descT);
      this.cameras.main.ignore(descT);

      // Click handler (only if not already selected)
      if (!someoneSelected || !mySelection) {
        const hitArea = this.add.rectangle(cx, cy, cardW, cardH, 0, 0).setInteractive({ useHandCursor: true });
        hitArea.on("pointerdown", () => {
          socket.emit("selectAugment", card.id);
        });
        this.draftOverlay!.add(hitArea);
        this.cameras.main.ignore(hitArea);
      }

      // "SELECTED" overlay
      if (isSelected) {
        const selT = this.add.text(cx, cy + cardH / 2 - 30, "SELECTED", {
          fontSize: "12px", color: tierColor.hex, fontStyle: "bold",
        }).setOrigin(0.5);
        this.draftOverlay!.add(selT);
        this.cameras.main.ignore(selT);
      }

      // Per-card reroll button (below each card)
      const rerolls = state.cardRerolls[i] ?? 0;
      if (rerolls > 0 && !mySelection) {
        const rrY = cy + cardH / 2 + 18;
        const rrGfx = this.add.graphics();
        rrGfx.fillStyle(HUD_BG, 1);
        rrGfx.fillRoundedRect(cx - 50, rrY - 12, 100, 24, 12);
        rrGfx.lineStyle(1, HUD_BORDER, 0.5);
        rrGfx.strokeRoundedRect(cx - 50, rrY - 12, 100, 24, 12);
        this.draftOverlay!.add(rrGfx);
        this.cameras.main.ignore(rrGfx);

        const rrText = this.add.text(cx, rrY, `Reroll (${rerolls})`, {
          fontSize: "11px", color: CORAL_HEX, fontStyle: "bold",
        }).setOrigin(0.5);
        this.draftOverlay!.add(rrText);
        this.cameras.main.ignore(rrText);

        const cardIdx = i;
        const rrHit = this.add.rectangle(cx, rrY, 100, 24, 0, 0).setInteractive({ useHandCursor: true });
        rrHit.on("pointerdown", () => socket.emit("rerollDraft", cardIdx));
        this.draftOverlay!.add(rrHit);
        this.cameras.main.ignore(rrHit);
      }
    });
  }

  private hideDraftOverlay(): void {
    if (this.draftOverlay) { this.draftOverlay.destroy(); this.draftOverlay = null; }
  }

  // ══════════════════════════════════
  // ── ROUND RESULT OVERLAY ──
  // ══════════════════════════════════

  private showResultOverlay(state: RoundResultState): void {
    this.hideResultOverlay();
    const w = this.sw; const h = this.sh;

    this.resultOverlay = this.add.container(0, 0).setDepth(2000);
    this.cameras.main.ignore(this.resultOverlay);

    const bg = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.75);
    this.resultOverlay.add(bg); this.cameras.main.ignore(bg);

    const title = this.add.text(w / 2, h / 2 - 80, `ROUND ${state.roundNumber} COMPLETE`, {
      fontSize: "28px", color: CORAL_HEX, fontStyle: "bold",
      fontFamily: "'Arial Black', Impact, sans-serif",
    }).setOrigin(0.5);
    this.resultOverlay.add(title); this.cameras.main.ignore(title);

    // Show kills this round + total
    const playerIds = Object.keys(state.roundKills);
    const sorted = playerIds.sort((a, b) => (state.totalKills[b] ?? 0) - (state.totalKills[a] ?? 0));

    let y = h / 2 - 30;
    for (const id of sorted) {
      const isMe = id === socket.id;
      const rk = state.roundKills[id] ?? 0;
      const tk = state.totalKills[id] ?? 0;
      const t = this.add.text(w / 2, y, `${isMe ? ">" : " "} ${id.slice(0, 6)}   Round: ${rk}   Total: ${tk}`, {
        fontSize: "14px", color: isMe ? "#ffffff" : "#aaaaaa", fontStyle: isMe ? "bold" : "normal",
      }).setOrigin(0.5, 0);
      this.resultOverlay.add(t); this.cameras.main.ignore(t);
      y += 22;
    }

    const nextText = state.roundNumber >= TOTAL_ROUNDS ? "Final results coming..." : "Next augment draft starting...";
    const nt = this.add.text(w / 2, y + 20, nextText, { fontSize: "12px", color: "#666680" }).setOrigin(0.5);
    this.resultOverlay.add(nt); this.cameras.main.ignore(nt);
  }

  private hideResultOverlay(): void {
    if (this.resultOverlay) { this.resultOverlay.destroy(); this.resultOverlay = null; }
  }

  // ══════════════════════════════════
  // ── WORLD RENDERING ──
  // ══════════════════════════════════

  private renderGame(): void {
    const state = this.gameState!;
    if (!this.wallsDrawn) { this.drawFloor(); this.drawWalls(state); this.wallsDrawn = true; }
    this.gameGraphics.clear();

    const me = this.getMe();
    if (me) {
      this.cameraTarget.setPosition(me.x, me.y);
      this.deathText.setVisible(!me.alive);
      if (!me.alive) this.deathText.setText("RESPAWNING...");
    }

    for (const g of state.pulseGrenades) this.drawGrenade(g.x, g.y, g.radius, g.remainingMs);

    this.updateBulletTrails(state.bullets);
    for (const b of state.bullets) this.drawBullet(b);
    for (const p of state.players) this.drawPlayer(p, p.x, p.y);

    // Nametags (world-space text above each player)
    const activeIds = new Set(state.players.map((p) => p.id));
    // Remove stale nametags
    for (const [id, tag] of this.nameTags.entries()) {
      if (!activeIds.has(id)) { tag.destroy(); this.nameTags.delete(id); }
    }
    // Update/create nametags
    for (const p of state.players) {
      if (!p.alive) {
        const existing = this.nameTags.get(p.id);
        if (existing) existing.setVisible(false);
        continue;
      }
      let tag = this.nameTags.get(p.id);
      if (!tag) {
        tag = this.add.text(0, 0, "", { fontSize: "11px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5).setDepth(50);
        this.hudCamera.ignore(tag);
        this.nameTags.set(p.id, tag);
      }
      const R = p.playerRadius || PLAYER_RADIUS;
      tag.setPosition(p.x, p.y - R - 24);
      tag.setText(p.name || p.id.slice(0, 6));
      tag.setVisible(true);
      tag.setColor(p.id === socket.id ? "#ff6b4a" : "#ffffff");
    }
  }

  private drawFloor(): void {
    const g = this.floorGraphics; g.clear();
    g.lineStyle(1, GRID_LINE, 0.4);
    for (let x = 0; x <= MAP_WIDTH; x += GRID_SIZE) g.lineBetween(x, 0, x, MAP_HEIGHT);
    for (let y = 0; y <= MAP_HEIGHT; y += GRID_SIZE) g.lineBetween(0, y, MAP_WIDTH, y);
    g.fillStyle(GRID_DOT, 0.6);
    for (let x = 0; x <= MAP_WIDTH; x += GRID_SIZE)
      for (let y = 0; y <= MAP_HEIGHT; y += GRID_SIZE) g.fillCircle(x, y, 1.5);
  }

  private drawWalls(state: GameState): void {
    const g = this.wallsGraphics; g.clear();
    for (const wall of state.walls) {
      const { x, y, w, h } = wall;
      g.fillStyle(0x080a18, 0.6); g.fillRoundedRect(x + 3, y + 3, w, h, 3);
      g.fillStyle(WALL_FILL, 1); g.fillRoundedRect(x, y, w, h, 3);
      g.fillStyle(WALL_HIGHLIGHT, 1); g.fillRect(x + 3, y, w - 6, 2); g.fillRect(x, y + 3, 2, h - 6);
      g.fillStyle(WALL_SHADOW, 1); g.fillRect(x + 3, y + h - 2, w - 6, 2); g.fillRect(x + w - 2, y + 3, 2, h - 6);
      g.lineStyle(1, WALL_HIGHLIGHT, 0.1); g.strokeRoundedRect(x + 4, y + 4, w - 8, h - 8, 2);
      g.fillStyle(WALL_HIGHLIGHT, 0.08); g.fillRect(x + 3, y + 3, w - 6, Math.min(h * 0.3, 8));
    }
  }

  private drawGrenade(x: number, y: number, radius: number, remainingMs: number): void {
    const g = this.gameGraphics;
    const alpha = Math.max(0.1, remainingMs / 3000);
    const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 150);
    g.fillStyle(GRENADE_COLOR, alpha * 0.08 * pulse); g.fillCircle(x, y, radius + 8);
    g.fillStyle(GRENADE_COLOR, alpha * 0.15); g.fillCircle(x, y, radius);
    g.lineStyle(2, GRENADE_COLOR, alpha * 0.7); g.strokeCircle(x, y, radius);
  }

  private updateBulletTrails(bullets: BulletState[]): void {
    const ids = new Set(bullets.map((b) => b.id));
    for (const id of this.bulletTrails.keys()) if (!ids.has(id)) this.bulletTrails.delete(id);
    for (const b of bullets) {
      let t = this.bulletTrails.get(b.id);
      if (!t) { t = []; this.bulletTrails.set(b.id, t); }
      t.push({ x: b.x, y: b.y });
      while (t.length > (b.bouncesRemaining > 0 ? 5 : 3)) t.shift();
    }
  }

  private drawBullet(bullet: BulletState): void {
    const g = this.gameGraphics;
    const color = bullet.bouncesRemaining > 0 ? BULLET_BOUNCE : BULLET_WHITE;
    const trail = this.bulletTrails.get(bullet.id);
    if (trail) for (let i = 0; i < trail.length - 1; i++) {
      g.fillStyle(color, (i + 1) / trail.length * 0.4);
      g.fillCircle(trail[i].x, trail[i].y, BULLET_RADIUS * (0.4 + 0.6 * (i / trail.length)));
    }
    g.fillStyle(color, 0.1); g.fillCircle(bullet.x, bullet.y, BULLET_RADIUS + 6);
    g.fillStyle(color, 0.25); g.fillCircle(bullet.x, bullet.y, BULLET_RADIUS + 3);
    g.fillStyle(color, 1); g.fillCircle(bullet.x, bullet.y, BULLET_RADIUS + 1);
    g.fillStyle(0xffffff, 0.8); g.fillCircle(bullet.x, bullet.y, BULLET_RADIUS * 0.5);
  }

  private drawPlayer(player: PlayerState, rx: number, ry: number): void {
    if (!player.alive) return;
    const g = this.gameGraphics;
    const cc = CHARACTER_COLORS[player.character] ?? 0xffffff;
    const isMe = player.id === socket.id;
    const angle = player.aimAngle;
    const R = player.playerRadius || PLAYER_RADIUS;

    g.fillStyle(cc, isMe ? 0.12 : 0.06); g.fillCircle(rx, ry, R + 14);
    if (player.damageFlashMs > 0) { g.fillStyle(0xff0000, 0.4); g.fillCircle(rx, ry, R + 8); }

    g.fillStyle(cc, isMe ? 1 : 0.85);
    switch (player.character) {
      case "Bruiser": this.drawOctagon(g, rx, ry, R + 2, R * 0.88); break;
      case "Phantom": this.drawTeardrop(g, rx, ry, R + 1, angle); break;
      case "Warden": this.drawHexagon(g, rx, ry, R + 1); break;
      default: g.fillCircle(rx, ry, R);
    }
    g.fillStyle(0xffffff, 0.15); g.fillCircle(rx - 2, ry - 3, R * 0.45);

    const oc = TEAM_COLORS[player.team] ?? TEAM_COLORS[0];
    g.lineStyle(isMe ? 3 : 2, oc, isMe ? 1 : 0.7); g.strokeCircle(rx, ry, R + 3);
    if (isMe) { g.lineStyle(1, oc, 0.25); g.strokeCircle(rx, ry, R + 7); }

    if (player.shieldGuardReady) {
      const sp = 0.6 + 0.4 * Math.sin(Date.now() / 200);
      g.lineStyle(2.5, 0xaaaaff, 0.8 * sp); g.strokeCircle(rx, ry, R + 8);
    }

    if (player.slowed || player.frozen) {
      const rot = Date.now() / 400;
      g.lineStyle(2.5, player.frozen ? 0x4488ff : GRENADE_COLOR, 0.55);
      for (let i = 0; i < 6; i++) { const a1 = rot + (i / 6) * Math.PI * 2; g.beginPath(); g.arc(rx, ry, R + 5, a1, a1 + Math.PI / 8); g.strokePath(); }
    }

    if (player.burning) {
      g.fillStyle(0xff6600, 0.2 + 0.1 * Math.sin(Date.now() / 100));
      g.fillCircle(rx, ry, R + 6);
    }

    const aimR = R + 10;
    g.fillStyle(0xffffff, 0.85); g.beginPath();
    g.moveTo(rx + Math.cos(angle) * (aimR + 5), ry + Math.sin(angle) * (aimR + 5));
    g.lineTo(rx + Math.cos(angle - 0.35) * aimR, ry + Math.sin(angle - 0.35) * aimR);
    g.lineTo(rx + Math.cos(angle + 0.35) * aimR, ry + Math.sin(angle + 0.35) * aimR);
    g.closePath(); g.fillPath();

    if (player.blinkBonusReady) { g.lineStyle(2, 0xffff00, 0.9); g.strokeCircle(rx, ry, R + 7); }
    if (player.abilityActive) { g.fillStyle(0xffffff, 0.3); g.fillCircle(rx, ry, R + 12); }

    // HP bar
    const hpPct = player.hp / player.maxHp;
    const bx = rx - HP_BAR_W / 2; const by = ry - R - 16;
    g.fillStyle(0x000000, 0.6); g.fillRoundedRect(bx - 2, by - 2, HP_BAR_W + 4, HP_BAR_H + 4, 4);
    g.fillStyle(0x1a1a2a, 1); g.fillRoundedRect(bx, by, HP_BAR_W, HP_BAR_H, 3);
    if (hpPct > 0) {
      g.fillStyle(hpPct > 0.6 ? 0x2ecc71 : hpPct > 0.3 ? 0xf39c12 : 0xe74c3c, 1);
      g.fillRoundedRect(bx, by, HP_BAR_W * hpPct, HP_BAR_H, 3);
      g.fillStyle(0xffffff, 0.2);
      g.fillRoundedRect(bx, by, HP_BAR_W * hpPct, HP_BAR_H * 0.4, { tl: 3, tr: 3, bl: 0, br: 0 });
    }
  }

  private drawOctagon(g: Phaser.GameObjects.Graphics, cx: number, cy: number, rW: number, rH: number): void {
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const px = cx + Math.cos(a) * (Math.abs(Math.cos(a)) > 0.5 ? rW : rW * 0.92);
      const py = cy + Math.sin(a) * (Math.abs(Math.sin(a)) > 0.5 ? rH : rH * 0.92);
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath(); g.fillPath();
  }

  private drawTeardrop(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, angle: number): void {
    g.beginPath();
    g.moveTo(cx + Math.cos(angle) * r * 1.3, cy + Math.sin(angle) * r * 1.3);
    g.lineTo(cx + Math.cos(angle + Math.PI / 2) * r * 0.65, cy + Math.sin(angle + Math.PI / 2) * r * 0.65);
    g.lineTo(cx + Math.cos(angle + Math.PI) * r * 0.9, cy + Math.sin(angle + Math.PI) * r * 0.9);
    g.lineTo(cx + Math.cos(angle - Math.PI / 2) * r * 0.65, cy + Math.sin(angle - Math.PI / 2) * r * 0.65);
    g.closePath(); g.fillPath();
  }

  private drawHexagon(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number): void {
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
      if (i === 0) g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      else g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.closePath(); g.fillPath();
  }

  // ══════════════════════════════════
  // ── HUD ──
  // ══════════════════════════════════

  private renderHUD(): void {
    this.hudGfx.clear();
    if (!this.gameState) return;
    const state = this.gameState;
    const w = this.sw; const h = this.sh;
    const g = this.hudGfx;

    // ── Timer panel (top center) ──
    const timerW = 220; const timerH = 56;
    g.fillStyle(HUD_BG, 0.85);
    g.fillRoundedRect(w / 2 - timerW / 2, 8, timerW, timerH, 12);
    g.lineStyle(1, HUD_BORDER, 0.5);
    g.strokeRoundedRect(w / 2 - timerW / 2, 8, timerW, timerH, 12);

    const secs = Math.max(0, Math.ceil(state.timeRemainingMs / 1000));
    this.timerText.setText(`R${state.roundNumber}/${TOTAL_ROUNDS}  ${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, "0")}`);

    const me = this.getMe();
    if (me) {
      const kd = me.deaths === 0 ? me.kills.toFixed(1) : (me.kills / me.deaths).toFixed(1);
      this.myStatsText.setText(`K: ${me.kills}  D: ${me.deaths}  KD: ${kd}`);
    }

    // ── Scoreboard (top left) ──
    const sorted = [...state.players].sort((a, b) => b.kills - a.kills);
    const scoreLines = sorted.length;
    if (scoreLines > 0) {
      const sbW = 200; const sbH = 16 + scoreLines * 20;
      g.fillStyle(HUD_BG, 0.8);
      g.fillRoundedRect(10, 10, sbW, sbH, 10);
      g.lineStyle(1, HUD_BORDER, 0.3);
      g.strokeRoundedRect(10, 10, sbW, sbH, 10);
    }
    this.scoreText.setText(sorted.map((p) => `${p.id === socket.id ? ">" : " "} ${p.name || p.id.slice(0, 6)}  ${p.kills}/${p.deaths}`).join("\n"));

    // TAB scoreboard
    if (this.tabKey.isDown) this.showScoreboard(state);
    else if (this.scoreboardContainer) { this.scoreboardContainer.destroy(); this.scoreboardContainer = null; }

    // ── Kill feed (top right) ──
    const kfLines = state.killFeed.length;
    if (kfLines > 0) {
      const kfW = 180; const kfH = 10 + kfLines * 18;
      g.fillStyle(HUD_BG, 0.7);
      g.fillRoundedRect(w - 10 - kfW, 10, kfW, kfH, 8);
    }
    this.killFeedText.setText(state.killFeed.map((e) => `${e.killerId.slice(0, 6)} > ${e.victimId.slice(0, 6)}`).join("\n"));

    if (me) {
      // ── Ability cooldown (bottom center) ──
      const cdReady = me.abilityCooldownRemaining <= 0;
      const cdW = 240; const cdH = 36;
      g.fillStyle(HUD_BG, 0.85);
      g.fillRoundedRect(w / 2 - cdW / 2, h - 10 - cdH, cdW, cdH, cdH / 2);
      if (cdReady) {
        g.lineStyle(2, 0x2ecc71, 0.6);
        g.strokeRoundedRect(w / 2 - cdW / 2, h - 10 - cdH, cdW, cdH, cdH / 2);
      } else {
        g.lineStyle(1, HUD_BORDER, 0.4);
        g.strokeRoundedRect(w / 2 - cdW / 2, h - 10 - cdH, cdW, cdH, cdH / 2);
        // Cooldown progress bar inside the pill
        const cdPct = 1 - (me.abilityCooldownRemaining / 6000); // rough estimate for visual
        g.fillStyle(0x2ecc71, 0.15);
        g.fillRoundedRect(w / 2 - cdW / 2 + 2, h - 8 - cdH, (cdW - 4) * Math.max(0, cdPct), cdH - 4, (cdH - 4) / 2);
      }
      this.cooldownText.setText(cdReady ? "ABILITY READY  [SPACE]" : `Ability  ${(me.abilityCooldownRemaining / 1000).toFixed(1)}s`);
      this.cooldownText.setColor(cdReady ? "#2ecc71" : "#cccccc");

      // ── Augment icons (bottom left) — larger, with labels ──
      if (me.augments.length > 0) {
        const augY = h - 60;
        const augPanelW = 12 + me.augments.length * 30;
        g.fillStyle(HUD_BG, 0.7);
        g.fillRoundedRect(10, augY - 16, augPanelW, 32, 8);

        me.augments.forEach((aug, i) => {
          const adx = 24 + i * 30;
          const augDef = findAugmentDef(aug);
          const c = augDef ? TIER_COLORS[augDef.tier].fill : 0x888888;
          // Bigger icon circle
          g.fillStyle(c, 0.25); g.fillCircle(adx, augY, 12);
          g.fillStyle(c, 0.85); g.fillCircle(adx, augY, 9);
          g.lineStyle(1.5, c, 0.5); g.strokeCircle(adx, augY, 12);
        });
      }

      // ── Stats panel (bottom right) — bigger, clearer ──
      const s = me.stats;
      const statPanelW = 180;
      const statPanelH = 130;
      const spx = w - 16 - statPanelW;
      const spy = h - 16 - statPanelH;
      g.fillStyle(HUD_BG, 0.85);
      g.fillRoundedRect(spx, spy, statPanelW, statPanelH, 10);
      g.lineStyle(1, HUD_BORDER, 0.4);
      g.strokeRoundedRect(spx, spy, statPanelW, statPanelH, 10);

      // "STATS" header
      g.fillStyle(HUD_BORDER, 0.6);
      g.fillRoundedRect(spx, spy, statPanelW, 20, { tl: 10, tr: 10, bl: 0, br: 0 });

      const statLines = [
        { label: "HP", val: `${Math.round(me.hp)} / ${s.health}`, color: 0x2ecc71 },
        { label: "ATK", val: `${s.attackDamage}`, color: 0xe74c3c },
        { label: "AS", val: `${s.attackSpeed}/s`, color: 0xf39c12 },
        { label: "ARM", val: `${s.armor}`, color: 0x3498db },
        { label: "MS", val: `${s.movementSpeed}`, color: 0x00ccff },
        { label: "RNG", val: s.range === 0 ? "INF" : `${s.range}`, color: 0xaa55ff },
      ];

      statLines.forEach((st, si) => {
        const sy = spy + 26 + si * 17;
        // Colored dot
        g.fillStyle(st.color, 1);
        g.fillCircle(spx + 14, sy + 4, 4);
      });

      if (!this._statsText) {
        this._statsText = this.add.text(0, 0, "", { fontSize: "13px", color: "#e0e0e0", lineSpacing: 5 }).setDepth(1000);
        this.hudContainer.add(this._statsText);
        this.cameras.main.ignore(this._statsText);
      }
      this._statsText.setPosition(spx + 26, spy + 6);
      const statsHeader = "─ STATS ─";
      this._statsText.setText([statsHeader, ...statLines.map((st) => `${st.label.padEnd(4)} ${st.val}`)].join("\n"));
    }
  }

  private showScoreboard(state: GameState): void {
    if (this.scoreboardContainer) this.scoreboardContainer.destroy();
    const w = this.sw; const h = this.sh;
    this.scoreboardContainer = this.add.container(0, 0).setDepth(1500);
    this.cameras.main.ignore(this.scoreboardContainer);
    const pw = Math.min(500, w - 60); const px = w / 2;
    this.scoreboardContainer.add(this.add.rectangle(px, h / 2, pw, h * 0.6, 0x000000, 0.8));
    const cn = px - pw / 2 + 16; const cc2 = cn + 90; const ck = cc2 + 80; const cd = ck + 50; const ckd = cd + 50; const cdm = ckd + 55;
    let y = h * 0.18;
    const row = (n: string, c: string, k: string, d: string, kd: string, dm: string, col: string, b = false) => {
      const s = { fontSize: "12px", color: col, fontStyle: b ? "bold" as const : "normal" as const };
      for (const [cx2, t] of [[cn, n], [cc2, c], [ck, k], [cd, d], [ckd, kd], [cdm, dm]] as [number, string][]) {
        const tx = this.add.text(cx2, y, t, s); this.scoreboardContainer!.add(tx); this.cameras.main.ignore(tx);
      }
      y += 18;
    };
    row("Player", "Char", "K", "D", "K/D", "Dmg", "#888888", true);
    for (const p of [...state.players].sort((a, b) => b.kills - a.kills)) {
      const im = p.id === socket.id;
      const kd = p.deaths === 0 ? p.kills.toFixed(1) : (p.kills / p.deaths).toFixed(1);
      row((im ? ">> " : "   ") + (p.name || p.id.slice(0, 6)), p.character, String(p.kills), String(p.deaths), kd, String(p.damageDealt), im ? "#ffffff" : "#e0e0e0", im);
    }
  }

  // ── Help ──

  private buildHelpButton(): void {
    const sz = 28; const bx = this.sw - 12 - sz / 2; const by = this.sh - 12 - sz / 2;
    this.helpBtnContainer = this.add.container(0, 0).setDepth(3000);
    const bg = this.add.rectangle(bx, by, sz, sz, HUD_BG, 0.8).setStrokeStyle(1, HUD_BORDER).setInteractive({ useHandCursor: true });
    const lb = this.add.text(bx, by, "?", { fontSize: "16px", color: "#aaaaaa", fontStyle: "bold" }).setOrigin(0.5);
    bg.on("pointerover", () => bg.setFillStyle(HUD_BORDER));
    bg.on("pointerout", () => bg.setFillStyle(HUD_BG));
    bg.on("pointerdown", () => this.toggleHelp());
    this.helpBtnContainer.add([bg, lb]);
    this.cameras.main.ignore(this.helpBtnContainer);
  }

  private toggleHelp(): void { if (this.helpOpen) this.closeHelpPanel(); else this.openHelpPanel(); }

  private openHelpPanel(): void {
    this.helpOpen = true;
    if (this.helpPanel) this.helpPanel.destroy();
    const ch = this.getMe()?.character ?? "Bruiser";
    const pw = 240; const ph = 190; const px = this.sw - 12 - pw / 2; const py = this.sh - 50 - ph / 2;
    this.helpPanel = this.add.container(0, 0).setDepth(2999);
    this.cameras.main.ignore(this.helpPanel);
    const bg = this.add.rectangle(px, py, pw, ph, 0x111122, 0.92).setStrokeStyle(1, HUD_BORDER);
    this.helpPanel.add(bg); this.cameras.main.ignore(bg);
    const left = px - pw / 2 + 12; let y = py - ph / 2 + 12;
    const addLine = (text: string, color: string, size = "11px", bold = false) => {
      const t = this.add.text(left, y, text, { fontSize: size, color, fontStyle: bold ? "bold" : "normal" });
      this.helpPanel!.add(t); this.cameras.main.ignore(t);
      y += parseInt(size) + 4;
    };
    addLine("CONTROLS", "#ffffff", "12px", true);
    addLine("WASD  Move    Mouse  Aim", "#cccccc");
    addLine("Click  Shoot    SPACE  Ability", "#cccccc");
    y += 4;
    const info = CHARACTER_INFO[ch];
    addLine(`YOUR CHARACTER: ${ch.toUpperCase()}`, info.color, "12px", true);
    addLine(`Ability: ${info.active}`, "#e0e0e0");
    addLine(`Passive: ${info.passive}`, "#999999");
    y += 4;
    addLine("Click ? again to close", "#666666", "10px");
  }

  private closeHelpPanel(): void { this.helpOpen = false; if (this.helpPanel) { this.helpPanel.destroy(); this.helpPanel = null; } }

  // ── Helpers ──

  private applyZoom(): void { this.cameras.main.setZoom(this.scale.height / LOGICAL_HEIGHT); }

  private getMe(): PlayerState | undefined { return this.gameState?.players.find((p) => p.id === socket.id); }

  shutdown() {
    this.closeHelpPanel();
    this.hideDraftOverlay();
    this.hideResultOverlay();
    if (this.helpBtnContainer) { this.helpBtnContainer.destroy(); this.helpBtnContainer = null; }
    if (this.scoreboardContainer) { this.scoreboardContainer.destroy(); this.scoreboardContainer = null; }
    this.bulletTrails.clear();
    for (const tag of this.nameTags.values()) tag.destroy();
    this.nameTags.clear();
    if (this.hudCamera) this.cameras.remove(this.hudCamera);
    socket.off("gameState");
    socket.off("draftState");
    socket.off("roundResult");
    socket.off("gameOver");
    this.input.off("pointerdown");
    this.input.off("pointerup");
    this.scale.off("resize");
  }
}

// Lookup augment definition by ID
function findAugmentDef(id: AugmentId): { tier: AugmentTier } | null {
  const TIERS: Record<string, AugmentTier> = {
    AttackBoost: "Silver", SpeedBoost: "Silver", HpBoost: "Silver", AttackSpeedBoost: "Silver", CritChance: "Silver",
    Multishot: "Gold", Ricochet: "Gold", PiercingShot: "Gold", BouncyWall: "Gold", Freeze: "Gold", Blaze: "Gold",
    FrontArrow: "Prismatic", SideArrows: "Prismatic", DeathNova: "Prismatic", ShieldGuard: "Prismatic", Giant: "Prismatic",
  };
  const tier = TIERS[id];
  return tier ? { tier } : null;
}
