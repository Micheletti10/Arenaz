import Phaser from "phaser";
import { socket } from "../network";
import type { RoomState, CharacterType, GameMode, Team } from "@arenaz/types";

const CHARACTERS: CharacterType[] = ["Bruiser", "Phantom", "Warden"];
const GAMEMODES: GameMode[] = ["Deathmatch", "TeamDeathmatch"];
const TEAMS: { label: string; value: Team }[] = [
  { label: "Red", value: 1 },
  { label: "Blue", value: 2 },
];

// ── Palette ──
const BG = 0x0a0b14;
const CARD = 0x12131f;
const CARD_BORDER = 0x1e2035;
const CORAL = 0xff6b4a;
const CORAL_HEX = "#ff6b4a";
const CORAL_LIGHT = "#ff9f43";
const WHITE = "#ffffff";
const DIM = "#666680";
const TEXT = "#c8c8d8";
const CHAR_COLORS: Record<string, { fill: number; hex: string }> = {
  Bruiser: { fill: 0xe74c3c, hex: "#e74c3c" },
  Phantom: { fill: 0x9b59b6, hex: "#9b59b6" },
  Warden: { fill: 0x2ecc71, hex: "#2ecc71" },
};

const HEADING_FONT = "'Arial Black', Impact, sans-serif";
const MONO_FONT = "'Courier New', monospace";

export class LobbyScene extends Phaser.Scene {
  private room: RoomState | null = null;
  private uiContainer!: Phaser.GameObjects.Container;
  private menuContainer!: Phaser.GameObjects.Container;
  private lobbyContainer!: Phaser.GameObjects.Container;
  private helpOverlay: Phaser.GameObjects.Container | null = null;
  private particleContainer!: Phaser.GameObjects.Container;

  private codeInput = "";
  private codeText!: Phaser.GameObjects.Text;
  private statusDot!: Phaser.GameObjects.Arc;
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "LobbyScene" });
  }

  create() {
    this.cameras.main.setZoom(1);
    this.cameras.main.setBackgroundColor(BG);

    // Particle field background
    this.particleContainer = this.add.container(0, 0);
    this.spawnParticles();

    this.uiContainer = this.add.container(0, 0).setDepth(10);
    this.buildMenuScreen();

    // Status indicator (bottom center)
    const cx = this.cameras.main.centerX;
    const h = this.cameras.main.height;
    this.statusDot = this.add.circle(cx - 50, h - 22, 4, 0x888888).setDepth(10);
    this.statusText = this.add.text(cx - 42, h - 28, "", { fontSize: "12px", color: DIM, fontFamily: HEADING_FONT }).setDepth(10);

    if (!socket.connected) {
      this.setStatus("Connecting...", 0xffaa00);
      socket.connect();
    } else {
      this.setStatus("Connected", 0x44ff44);
    }

    socket.on("connect", () => this.setStatus("Connected", 0x44ff44));
    socket.on("connect_error" as never, () => this.setStatus("Cannot reach server", 0xff4444));

    socket.on("roomState", (state) => {
      this.room = state;
      if (state.started) { this.scene.start("GameScene"); return; }
      this.showLobbyScreen();
    });

    socket.on("error", (msg) => this.showError(msg));

    this.input.keyboard!.on("keydown", (event: KeyboardEvent) => {
      if (event.key === "Escape" && this.helpOverlay) { this.closeHelp(); return; }
      if (!this.menuContainer.visible || this.helpOverlay) return;
      if (event.key === "Backspace") {
        this.codeInput = this.codeInput.slice(0, -1);
      } else if (/^\d$/.test(event.key) && this.codeInput.length < 4) {
        this.codeInput += event.key;
      }
      this.codeText.setText(this.codeInput.length > 0 ? this.codeInput : "____");
      this.codeText.setColor(this.codeInput.length > 0 ? WHITE : DIM);
    });
  }

  private setStatus(text: string, color: number): void {
    this.statusText.setText(text);
    this.statusText.setColor(`#${color.toString(16).padStart(6, "0")}`);
    this.statusDot.setFillStyle(color);
    // Pulse animation on the dot
    this.tweens.killTweensOf(this.statusDot);
    if (color === 0x44ff44) {
      this.tweens.add({ targets: this.statusDot, alpha: { from: 1, to: 0.3 }, duration: 1500, yoyo: true, repeat: -1 });
    } else {
      this.statusDot.setAlpha(1);
    }
  }

  // ── Particles ──

  private spawnParticles(): void {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    for (let i = 0; i < 35; i++) {
      const dot = this.add.circle(
        Phaser.Math.Between(0, w),
        Phaser.Math.Between(0, h),
        Phaser.Math.Between(1, 2),
        0xffffff,
        Phaser.Math.FloatBetween(0.03, 0.12)
      );
      this.particleContainer.add(dot);
      this.tweens.add({
        targets: dot,
        x: dot.x + Phaser.Math.Between(-100, 100),
        y: dot.y + Phaser.Math.Between(-60, 60),
        alpha: { from: dot.alpha, to: Phaser.Math.FloatBetween(0.02, 0.1) },
        duration: Phaser.Math.Between(4000, 10000),
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  }

  // ── Main Menu ──

  private buildMenuScreen(): void {
    this.menuContainer = this.add.container(0, 0);
    this.uiContainer.add(this.menuContainer);

    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;

    // Title with glow pulse
    const title = this.add.text(cx, cy - 150, "ARENAZ", {
      fontSize: "56px", color: CORAL_HEX, fontStyle: "bold", fontFamily: HEADING_FONT,
    }).setOrigin(0.5);
    this.menuContainer.add(title);
    this.tweens.add({ targets: title, alpha: { from: 1, to: 0.7 }, duration: 2000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

    // Subtitle
    this.menuContainer.add(
      this.add.text(cx, cy - 100, "MULTIPLAYER ARENA", { fontSize: "12px", color: DIM, fontFamily: HEADING_FONT, letterSpacing: 6 }).setOrigin(0.5)
    );

    // Create Room — solid coral pill
    this.menuContainer.add(this.makePill(cx, cy - 20, 220, 44, "Create Room", "solid", () => socket.emit("createRoom")));

    // Divider
    this.menuContainer.add(
      this.add.text(cx, cy + 35, "or join with code", { fontSize: "11px", color: DIM }).setOrigin(0.5)
    );

    // Code input field
    const inputW = 180;
    const inputH = 42;
    const inputBg = this.add.graphics();
    inputBg.fillStyle(CARD, 1);
    inputBg.fillRoundedRect(cx - inputW / 2, cy + 55, inputW, inputH, 8);
    // Bottom accent line
    inputBg.fillStyle(CORAL, 1);
    inputBg.fillRect(cx - inputW / 2 + 20, cy + 55 + inputH - 2, inputW - 40, 2);
    this.menuContainer.add(inputBg);

    this.codeText = this.add.text(cx, cy + 76, "____", {
      fontSize: "22px", color: DIM, fontFamily: MONO_FONT,
    }).setOrigin(0.5);
    this.menuContainer.add(this.codeText);

    // Join Room — outlined pill
    this.menuContainer.add(this.makePill(cx, cy + 125, 220, 44, "Join Room", "outline", () => {
      if (this.codeInput.length === 4) socket.emit("joinRoom", this.codeInput);
    }));

    // How to Play — ghost pill
    this.menuContainer.add(this.makePill(cx, cy + 195, 160, 36, "How to Play", "ghost", () => this.openHelp()));
  }

  // ── Pill button factory ──

  private makePill(
    x: number, y: number, w: number, h: number, label: string,
    style: "solid" | "outline" | "ghost", onClick: () => void
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const gfx = this.add.graphics();
    const r = h / 2; // full pill radius

    const drawBg = (fill: number, fillAlpha: number, stroke: number, strokeAlpha: number) => {
      gfx.clear();
      if (fillAlpha > 0) { gfx.fillStyle(fill, fillAlpha); gfx.fillRoundedRect(-w / 2, -h / 2, w, h, r); }
      if (strokeAlpha > 0) { gfx.lineStyle(2, stroke, strokeAlpha); gfx.strokeRoundedRect(-w / 2, -h / 2, w, h, r); }
    };

    let textColor = WHITE;
    if (style === "solid") {
      drawBg(CORAL, 1, 0, 0);
      textColor = WHITE;
    } else if (style === "outline") {
      drawBg(CARD, 1, CORAL, 0.8);
      textColor = CORAL_HEX;
    } else {
      drawBg(0, 0, CARD_BORDER, 0.5);
      textColor = DIM;
    }

    const text = this.add.text(0, 0, label, {
      fontSize: style === "ghost" ? "13px" : "15px",
      color: textColor,
      fontStyle: "bold",
      fontFamily: HEADING_FONT,
    }).setOrigin(0.5);

    // Hit area
    const hitArea = this.add.rectangle(0, 0, w, h, 0x000000, 0).setInteractive({ useHandCursor: true });
    hitArea.on("pointerover", () => {
      if (style === "solid") drawBg(0xff8866, 1, 0, 0);
      else if (style === "outline") drawBg(CORAL, 0.15, CORAL, 1);
      else drawBg(CARD_BORDER, 0.2, CARD_BORDER, 0.8);
    });
    hitArea.on("pointerout", () => {
      if (style === "solid") drawBg(CORAL, 1, 0, 0);
      else if (style === "outline") drawBg(CARD, 1, CORAL, 0.8);
      else drawBg(0, 0, CARD_BORDER, 0.5);
    });
    hitArea.on("pointerdown", onClick);

    container.add([gfx, text, hitArea]);
    return container;
  }

  // ── Lobby ──

  private showLobbyScreen(): void {
    this.menuContainer.setVisible(false);
    this.closeHelp();
    if (this.lobbyContainer) this.lobbyContainer.destroy();

    this.lobbyContainer = this.add.container(0, 0).setDepth(10);
    this.uiContainer.add(this.lobbyContainer);

    const room = this.room!;
    const cx = this.cameras.main.centerX;
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const isHost = room.hostId === socket.id;

    // ── Room code badge ──
    const badgeW = 200;
    const badgeH = 42;
    const badgeGfx = this.add.graphics();
    badgeGfx.fillStyle(CARD, 1);
    badgeGfx.fillRoundedRect(cx - badgeW / 2, 20, badgeW, badgeH, 21);
    badgeGfx.lineStyle(1, CARD_BORDER, 0.6);
    badgeGfx.strokeRoundedRect(cx - badgeW / 2, 20, badgeW, badgeH, 21);
    this.lobbyContainer.add(badgeGfx);
    this.lobbyContainer.add(
      this.add.text(cx, 41, room.code, { fontSize: "22px", color: CORAL_HEX, fontFamily: MONO_FONT, fontStyle: "bold" }).setOrigin(0.5)
    );

    // ── Gamemode toggle cards ──
    const cardW = 200;
    const cardH = 60;
    const cardY = 85;
    const modeDescs: Record<string, string> = {
      Deathmatch: "Free-for-all, first to 15 kills",
      TeamDeathmatch: "Red vs Blue, most kills wins",
    };

    GAMEMODES.forEach((mode, i) => {
      const cardX = cx - 110 + i * 220;
      const selected = room.gameMode === mode;
      const gfx = this.add.graphics();

      gfx.fillStyle(selected ? 0x1a1b2e : CARD, 1);
      gfx.fillRoundedRect(cardX - cardW / 2, cardY, cardW, cardH, 10);
      gfx.lineStyle(2, selected ? CORAL : CARD_BORDER, selected ? 0.9 : 0.3);
      gfx.strokeRoundedRect(cardX - cardW / 2, cardY, cardW, cardH, 10);
      this.lobbyContainer.add(gfx);

      const modeLabel = mode === "TeamDeathmatch" ? "Team DM" : mode;
      this.lobbyContainer.add(
        this.add.text(cardX, cardY + 18, modeLabel, {
          fontSize: "15px", color: selected ? CORAL_HEX : TEXT, fontStyle: "bold", fontFamily: HEADING_FONT,
        }).setOrigin(0.5)
      );
      this.lobbyContainer.add(
        this.add.text(cardX, cardY + 38, modeDescs[mode], {
          fontSize: "10px", color: selected ? TEXT : DIM,
        }).setOrigin(0.5)
      );

      if (isHost) {
        const hit = this.add.rectangle(cardX, cardY + cardH / 2, cardW, cardH, 0, 0).setInteractive({ useHandCursor: true });
        hit.on("pointerdown", () => socket.emit("selectGamemode", mode));
        this.lobbyContainer.add(hit);
      }
    });

    // ── Player cards ──
    const listY = 165;
    const playerCardW = Math.min(500, w - 60);

    room.players.forEach((player, i) => {
      const cy2 = listY + i * 64;
      const isMe = player.id === socket.id;
      const shortId = player.id.slice(0, 6);

      // Card background
      const cardGfx = this.add.graphics();
      cardGfx.fillStyle(isMe ? 0x151628 : CARD, 1);
      cardGfx.fillRoundedRect(cx - playerCardW / 2, cy2, playerCardW, 54, 8);
      cardGfx.lineStyle(1, isMe ? CORAL : CARD_BORDER, isMe ? 0.4 : 0.2);
      cardGfx.strokeRoundedRect(cx - playerCardW / 2, cy2, playerCardW, 54, 8);
      this.lobbyContainer.add(cardGfx);

      // Player name
      const nameX = cx - playerCardW / 2 + 16;
      this.lobbyContainer.add(
        this.add.text(nameX, cy2 + 18, shortId, {
          fontSize: "14px", color: isMe ? WHITE : TEXT, fontStyle: isMe ? "bold" : "normal", fontFamily: MONO_FONT,
        })
      );

      // HOST badge
      if (player.isHost) {
        const hostBadgeX = nameX + 75;
        const hg = this.add.graphics();
        hg.fillStyle(CORAL, 0.2);
        hg.fillRoundedRect(hostBadgeX, cy2 + 16, 46, 20, 10);
        this.lobbyContainer.add(hg);
        this.lobbyContainer.add(
          this.add.text(hostBadgeX + 23, cy2 + 26, "HOST", {
            fontSize: "10px", color: CORAL_HEX, fontStyle: "bold", fontFamily: HEADING_FONT,
          }).setOrigin(0.5)
        );
      }

      // Character badges
      const charStartX = cx + 20;
      CHARACTERS.forEach((char, ci) => {
        const bx = charStartX + ci * 70;
        const selected = player.character === char;
        const cc = CHAR_COLORS[char];
        const bg = this.add.graphics();

        if (selected) {
          bg.fillStyle(cc.fill, 0.9);
          bg.fillRoundedRect(bx, cy2 + 14, 60, 26, 13);
        } else {
          bg.lineStyle(1, cc.fill, 0.4);
          bg.strokeRoundedRect(bx, cy2 + 14, 60, 26, 13);
        }
        this.lobbyContainer.add(bg);

        this.lobbyContainer.add(
          this.add.text(bx + 30, cy2 + 27, char, {
            fontSize: "11px",
            color: selected ? WHITE : cc.hex,
            fontStyle: selected ? "bold" : "normal",
            fontFamily: HEADING_FONT,
          }).setOrigin(0.5)
        );

        if (isMe) {
          const hit = this.add.rectangle(bx + 30, cy2 + 27, 60, 26, 0, 0).setInteractive({ useHandCursor: true });
          hit.on("pointerdown", () => socket.emit("selectCharacter", char));
          this.lobbyContainer.add(hit);
        }
      });

      // Team assignment (TDM)
      if (room.gameMode === "TeamDeathmatch") {
        const teamX = cx + playerCardW / 2 - 90;
        if (isHost) {
          TEAMS.forEach((t, ti) => {
            const tx = teamX + ti * 40;
            const selected = player.team === t.value;
            const tc = t.value === 1 ? 0xe74c3c : 0x3498db;
            const tg = this.add.graphics();
            if (selected) {
              tg.fillStyle(tc, 0.8); tg.fillRoundedRect(tx, cy2 + 16, 34, 22, 11);
            } else {
              tg.lineStyle(1, tc, 0.4); tg.strokeRoundedRect(tx, cy2 + 16, 34, 22, 11);
            }
            this.lobbyContainer.add(tg);
            this.lobbyContainer.add(
              this.add.text(tx + 17, cy2 + 27, t.label[0], {
                fontSize: "11px", color: selected ? WHITE : `#${tc.toString(16)}`, fontStyle: "bold",
              }).setOrigin(0.5)
            );
            const hit = this.add.rectangle(tx + 17, cy2 + 27, 34, 22, 0, 0).setInteractive({ useHandCursor: true });
            hit.on("pointerdown", () => socket.emit("assignTeam", player.id, t.value));
            this.lobbyContainer.add(hit);
          });
        } else {
          const teamLabel = player.team === 1 ? "Red" : player.team === 2 ? "Blue" : "—";
          const teamColor = player.team === 1 ? "#e74c3c" : player.team === 2 ? "#3498db" : DIM;
          this.lobbyContainer.add(
            this.add.text(teamX + 40, cy2 + 27, teamLabel, { fontSize: "12px", color: teamColor, fontStyle: "bold" }).setOrigin(0.5)
          );
        }
      }
    });

    // ── Start / Waiting ──
    const bottomY = listY + room.players.length * 64 + 20;
    const allPicked = room.players.every((p) => p.character !== null);
    const enoughPlayers = room.players.length >= 2;
    const teamsOk = room.gameMode !== "TeamDeathmatch" || room.players.every((p) => p.team !== 0);
    const canStart = allPicked && enoughPlayers && teamsOk;

    if (isHost) {
      if (canStart) {
        this.lobbyContainer.add(this.makePill(cx, bottomY + 22, 220, 46, "Start Game", "solid", () => socket.emit("startGame")));
      } else {
        // Muted start button
        const gfx = this.add.graphics();
        gfx.fillStyle(CARD, 1);
        gfx.fillRoundedRect(cx - 110, bottomY, 220, 46, 23);
        this.lobbyContainer.add(gfx);
        this.lobbyContainer.add(
          this.add.text(cx, bottomY + 23, "Start Game", { fontSize: "15px", color: DIM, fontStyle: "bold", fontFamily: HEADING_FONT }).setOrigin(0.5)
        );
        // Reason text
        const reason = !enoughPlayers ? "Need at least 2 players" : !allPicked ? "All players must pick a character" : "All players must be assigned a team";
        this.lobbyContainer.add(
          this.add.text(cx, bottomY + 54, reason, { fontSize: "10px", color: DIM }).setOrigin(0.5)
        );
      }
    } else {
      this.lobbyContainer.add(
        this.add.text(cx, bottomY + 22, "Waiting for host to start...", { fontSize: "14px", color: DIM }).setOrigin(0.5)
      );
    }

    // How to Play (bottom-right ghost)
    this.lobbyContainer.add(this.makePill(w - 80, h - 36, 120, 30, "How to Play", "ghost", () => this.openHelp()));
  }

  // ── Help Overlay ──

  private openHelp(): void {
    if (this.helpOverlay) return;
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    this.helpOverlay = this.add.container(0, 0).setDepth(200);
    this.helpOverlay.add(this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.85).setInteractive());

    const panelW = Math.min(700, w - 40);
    const panelH = Math.min(600, h - 40);
    const px = w / 2;
    const py = h / 2;

    const panelGfx = this.add.graphics();
    panelGfx.fillStyle(CARD, 1);
    panelGfx.fillRoundedRect(px - panelW / 2, py - panelH / 2, panelW, panelH, 12);
    panelGfx.lineStyle(1, CARD_BORDER, 0.5);
    panelGfx.strokeRoundedRect(px - panelW / 2, py - panelH / 2, panelW, panelH, 12);
    this.helpOverlay.add(panelGfx);

    const left = px - panelW / 2 + 24;
    let y = py - panelH / 2 + 24;

    this.helpOverlay.add(this.add.text(px, y, "HOW TO PLAY", { fontSize: "20px", color: CORAL_HEX, fontStyle: "bold", fontFamily: HEADING_FONT }).setOrigin(0.5, 0));

    // Close X
    const closeBtn = this.makePill(px + panelW / 2 - 30, y + 10, 28, 28, "X", "ghost", () => this.closeHelp());
    this.helpOverlay.add(closeBtn);
    y += 40;

    const section = (title: string) => {
      this.helpOverlay!.add(this.add.text(left, y, title, { fontSize: "13px", color: CORAL_HEX, fontStyle: "bold", fontFamily: HEADING_FONT }));
      y += 20;
    };
    const line = (text: string, color = TEXT, size = "11px") => {
      this.helpOverlay!.add(this.add.text(left + 8, y, text, { fontSize: size, color }));
      y += 15;
    };

    section("CONTROLS");
    line("WASD — Move"); line("Mouse — Aim"); line("Left Click — Shoot"); line("SPACE — Use ability");
    y += 6;

    section("CHARACTERS");
    const chars = [
      { name: "Bruiser", color: "#e74c3c", desc: "High HP, medium speed", active: "Shield Bash — Knockback", passive: "15% less damage below 40% HP" },
      { name: "Phantom", color: "#9b59b6", desc: "Low HP, high speed, high damage", active: "Blink — Teleport forward", passive: "+50% damage after Blink" },
      { name: "Warden", color: "#2ecc71", desc: "Medium HP, medium speed", active: "Pulse Grenade — AoE slow", passive: "2 HP/s heal after 3s no damage" },
    ];
    for (const c of chars) {
      this.helpOverlay.add(this.add.text(left + 8, y, c.name, { fontSize: "12px", color: c.color, fontStyle: "bold" }));
      this.helpOverlay.add(this.add.text(left + 75, y, c.desc, { fontSize: "10px", color: DIM }));
      y += 14;
      line(`  Ability: ${c.active}`); line(`  Passive: ${c.passive}`, DIM);
      y += 4;
    }

    section("POWERUPS");
    const pus = [
      { n: "SpeedBoost", c: 0x00ccff, e: "+40% speed, 8s" }, { n: "DamageBoost", c: 0xff4400, e: "+75% damage, 6s" },
      { n: "Heal", c: 0x44ff44, e: "Instant +30 HP" }, { n: "Shield", c: 0xaaaaff, e: "Blocks 2 hits, 10s" },
      { n: "Bouncing", c: 0xff8800, e: "Bullets bounce 3x, 8s" }, { n: "RapidFire", c: 0xffff00, e: "2x rate -30% dmg, 6s" },
      { n: "Chaos", c: 0xff00ff, e: "Random powerup" },
    ];
    const colW = (panelW - 64) / 2;
    for (let i = 0; i < pus.length; i++) {
      const pu = pus[i];
      const col = i < 4 ? 0 : 1;
      const row = i < 4 ? i : i - 4;
      const bx = left + col * colW;
      const by = y + row * 18;
      this.helpOverlay.add(this.add.circle(bx + 6, by + 6, 4, pu.c));
      this.helpOverlay.add(this.add.text(bx + 14, by, pu.n, { fontSize: "10px", color: TEXT }));
      this.helpOverlay.add(this.add.text(bx + 95, by, pu.e, { fontSize: "10px", color: DIM }));
    }
    y += 4 * 18 + 10;

    section("GAMEMODES");
    this.helpOverlay.add(this.add.text(left + 8, y, "Deathmatch", { fontSize: "11px", color: CORAL_HEX, fontStyle: "bold" }));
    this.helpOverlay.add(this.add.text(left + 100, y, "FFA. First to 15 kills or most after 3 min.", { fontSize: "10px", color: TEXT }));
    y += 16;
    this.helpOverlay.add(this.add.text(left + 8, y, "Team DM", { fontSize: "11px", color: CORAL_HEX, fontStyle: "bold" }));
    this.helpOverlay.add(this.add.text(left + 100, y, "Red vs Blue. Respawn. Most kills after 3 min.", { fontSize: "10px", color: TEXT }));
  }

  private closeHelp(): void {
    if (!this.helpOverlay) return;
    this.helpOverlay.destroy();
    this.helpOverlay = null;
  }

  // ── Error toast ──

  private errorText: Phaser.GameObjects.Text | null = null;

  private showError(msg: string): void {
    if (this.errorText) this.errorText.destroy();
    const cx = this.cameras.main.centerX;
    this.errorText = this.add.text(cx, this.cameras.main.height - 50, msg, {
      fontSize: "13px", color: "#ff4444", fontFamily: HEADING_FONT,
    }).setOrigin(0.5).setDepth(100);
    this.time.delayedCall(3000, () => { this.errorText?.destroy(); this.errorText = null; });
  }

  shutdown(): void {
    this.closeHelp();
    socket.off("roomState");
    socket.off("error");
    socket.off("connect");
    socket.off("connect_error" as never);
    this.input.keyboard!.off("keydown");
  }
}
