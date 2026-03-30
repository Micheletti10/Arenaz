import Phaser from "phaser";
import { socket } from "../network";
import type { RoomState, GameMode } from "@arenaz/types";

const MODES: GameMode[] = ["FFA", "Duo"];
const BG = 0x0a0b14;
const CARD = 0x12131f;
const CARD_BORDER = 0x1e2035;
const CORAL = 0xff6b4a;
const CORAL_HEX = "#ff6b4a";
const CORAL_LIGHT = "#ff9070";
const WHITE = "#ffffff";
const DIM = "#555570";
const TEXT = "#c8c8d8";
const HEADING = "'Arial Black', Impact, sans-serif";
const MONO = "'Courier New', monospace";

export class LobbyScene extends Phaser.Scene {
  private room: RoomState | null = null;
  private uiContainer!: Phaser.GameObjects.Container;
  private menuContainer!: Phaser.GameObjects.Container;
  private lobbyContainer!: Phaser.GameObjects.Container;
  private nameInput = "";
  private nameText!: Phaser.GameObjects.Text;
  private codeInput = "";
  private codeText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private particles!: Phaser.GameObjects.Container;

  constructor() { super({ key: "LobbyScene" }); }

  create() {
    this.cameras.main.setZoom(1).setBackgroundColor(BG);

    // Animated particle background
    this.particles = this.add.container(0, 0);
    const w = this.cameras.main.width; const h = this.cameras.main.height;
    for (let i = 0; i < 40; i++) {
      const dot = this.add.circle(Phaser.Math.Between(0, w), Phaser.Math.Between(0, h), Phaser.Math.Between(1, 2), 0xffffff, Phaser.Math.FloatBetween(0.02, 0.08));
      this.particles.add(dot);
      this.tweens.add({ targets: dot, x: dot.x + Phaser.Math.Between(-80, 80), y: dot.y + Phaser.Math.Between(-40, 40), alpha: { from: dot.alpha, to: Phaser.Math.FloatBetween(0.01, 0.06) }, duration: Phaser.Math.Between(4000, 9000), yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }

    this.uiContainer = this.add.container(0, 0).setDepth(10);
    this.buildMenuScreen();

    this.statusText = this.add.text(w / 2, h - 24, "", { fontSize: "12px", color: DIM }).setOrigin(0.5).setDepth(10);
    if (!socket.connected) { this.statusText.setText("Connecting...").setColor("#ffaa00"); socket.connect(); }
    else { this.statusText.setText("Connected").setColor("#44ff44"); }

    socket.on("connect", () => this.statusText.setText("Connected").setColor("#44ff44"));
    socket.on("connect_error" as never, () => { this.statusText.setText("Cannot reach server").setColor("#ff4444"); });
    socket.on("roomState", (state) => { this.room = state; if (state.started) { this.scene.start("GameScene"); return; } this.showLobbyScreen(); });
    socket.on("error", (msg) => this.showError(msg));

    this.input.keyboard!.on("keydown", (event: KeyboardEvent) => {
      if (!this.menuContainer.visible) return;
      if (event.key === "Backspace") {
        if (this.codeInput.length > 0) this.codeInput = this.codeInput.slice(0, -1);
        else this.nameInput = this.nameInput.slice(0, -1);
      } else if (/^\d$/.test(event.key) && this.codeInput.length < 4) {
        this.codeInput += event.key;
      } else if (/^[a-zA-Z0-9]$/.test(event.key) && this.nameInput.length < 12 && this.codeInput.length === 0) {
        this.nameInput += event.key;
      }
      this.nameText.setText(this.nameInput || "Type your name...").setColor(this.nameInput ? WHITE : DIM);
      this.codeText.setText(this.codeInput || "_ _ _ _").setColor(this.codeInput ? WHITE : DIM);
    });
  }

  private buildMenuScreen(): void {
    this.menuContainer = this.add.container(0, 0);
    this.uiContainer.add(this.menuContainer);
    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;

    // ── Central card panel ──
    const panelW = 360; const panelH = 480;
    const panelY = cy - panelH / 2 - 10;
    const pg = this.add.graphics();
    pg.fillStyle(CARD, 0.85);
    pg.fillRoundedRect(cx - panelW / 2, panelY, panelW, panelH, 20);
    pg.lineStyle(1, CARD_BORDER, 0.4);
    pg.strokeRoundedRect(cx - panelW / 2, panelY, panelW, panelH, 20);
    this.menuContainer.add(pg);

    let y = panelY + 30;

    // Title
    const title = this.add.text(cx, y, "ARENAZ", { fontSize: "52px", color: CORAL_HEX, fontStyle: "bold", fontFamily: HEADING }).setOrigin(0.5);
    this.menuContainer.add(title);
    this.tweens.add({ targets: title, alpha: { from: 1, to: 0.7 }, duration: 2000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    y += 48;

    this.menuContainer.add(this.add.text(cx, y, "MULTIPLAYER ARENA", { fontSize: "10px", color: DIM, fontFamily: HEADING, letterSpacing: 8 }).setOrigin(0.5));
    y += 36;

    // ── Divider line ──
    const dg1 = this.add.graphics();
    dg1.lineStyle(1, CARD_BORDER, 0.5);
    dg1.lineBetween(cx - panelW / 2 + 30, y, cx + panelW / 2 - 30, y);
    this.menuContainer.add(dg1);
    y += 20;

    // ── Name input ──
    this.menuContainer.add(this.add.text(cx - panelW / 2 + 35, y, "PLAYER NAME", { fontSize: "10px", color: CORAL_LIGHT, fontStyle: "bold", fontFamily: HEADING }).setOrigin(0, 0.5));
    y += 18;
    const nameFieldW = panelW - 60;
    const nbg = this.add.graphics();
    nbg.fillStyle(0x080a14, 1); nbg.fillRoundedRect(cx - nameFieldW / 2, y, nameFieldW, 44, 10);
    nbg.lineStyle(2, CORAL, 0.5); nbg.strokeRoundedRect(cx - nameFieldW / 2, y, nameFieldW, 44, 10);
    this.menuContainer.add(nbg);
    this.nameText = this.add.text(cx, y + 22, "Type your name...", { fontSize: "18px", color: DIM, fontFamily: MONO }).setOrigin(0.5);
    this.menuContainer.add(this.nameText);
    y += 60;

    // ── Create Room ──
    this.menuContainer.add(this.makePill(cx, y + 22, panelW - 60, 48, "CREATE ROOM", "solid", () => {
      if (this.nameInput.length > 0) socket.emit("createRoom", this.nameInput);
      else this.showError("Enter a name first");
    }));
    y += 66;

    // ── OR divider ──
    const orG = this.add.graphics();
    orG.lineStyle(1, CARD_BORDER, 0.3);
    orG.lineBetween(cx - panelW / 2 + 30, y, cx - 25, y);
    orG.lineBetween(cx + 25, y, cx + panelW / 2 - 30, y);
    this.menuContainer.add(orG);
    this.menuContainer.add(this.add.text(cx, y, "OR", { fontSize: "10px", color: DIM, fontStyle: "bold", fontFamily: HEADING }).setOrigin(0.5));
    y += 24;

    // ── Room code input ──
    this.menuContainer.add(this.add.text(cx - panelW / 2 + 35, y, "ROOM CODE", { fontSize: "10px", color: TEXT, fontStyle: "bold", fontFamily: HEADING }).setOrigin(0, 0.5));
    y += 18;
    const codeFieldW = panelW - 60;
    const cbg = this.add.graphics();
    cbg.fillStyle(0x080a14, 1); cbg.fillRoundedRect(cx - codeFieldW / 2, y, codeFieldW, 44, 10);
    cbg.lineStyle(1, CARD_BORDER, 0.5); cbg.strokeRoundedRect(cx - codeFieldW / 2, y, codeFieldW, 44, 10);
    this.menuContainer.add(cbg);
    this.codeText = this.add.text(cx, y + 22, "_ _ _ _", { fontSize: "20px", color: DIM, fontFamily: MONO, letterSpacing: 4 }).setOrigin(0.5);
    this.menuContainer.add(this.codeText);
    y += 58;

    // ── Join Room ──
    this.menuContainer.add(this.makePill(cx, y + 22, panelW - 60, 48, "JOIN ROOM", "outline", () => {
      if (!this.nameInput) { this.showError("Enter a name first"); return; }
      if (this.codeInput.length === 4) socket.emit("joinRoom", this.codeInput, this.nameInput);
      else this.showError("Enter a 4-digit room code");
    }));
  }

  // ── Lobby room view ──
  private showLobbyScreen(): void {
    this.menuContainer.setVisible(false);
    if (this.lobbyContainer) this.lobbyContainer.destroy();
    this.lobbyContainer = this.add.container(0, 0).setDepth(10);
    this.uiContainer.add(this.lobbyContainer);

    const room = this.room!;
    const cx = this.cameras.main.centerX;
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const isHost = room.hostId === socket.id;

    // Room code badge
    const rg = this.add.graphics();
    rg.fillStyle(CARD, 0.9); rg.fillRoundedRect(cx - 110, 16, 220, 48, 24);
    rg.lineStyle(1, CARD_BORDER, 0.5); rg.strokeRoundedRect(cx - 110, 16, 220, 48, 24);
    this.lobbyContainer.add(rg);
    this.lobbyContainer.add(this.add.text(cx - 36, 40, "ROOM", { fontSize: "10px", color: DIM, fontFamily: HEADING }).setOrigin(1, 0.5));
    this.lobbyContainer.add(this.add.text(cx, 40, room.code, { fontSize: "24px", color: CORAL_HEX, fontFamily: MONO, fontStyle: "bold" }).setOrigin(0.5));

    // Gamemode toggle
    const modeY = 85;
    MODES.forEach((mode, i) => {
      const mx = cx - 130 + i * 260;
      const selected = room.gameMode === mode;
      const desc = mode === "FFA" ? "Free-for-all" : "Teams of 2";
      const mg = this.add.graphics();
      mg.fillStyle(selected ? 0x1a1b2e : CARD, 1);
      mg.fillRoundedRect(mx - 110, modeY, 220, 52, 12);
      mg.lineStyle(2, selected ? CORAL : CARD_BORDER, selected ? 0.8 : 0.2);
      mg.strokeRoundedRect(mx - 110, modeY, 220, 52, 12);
      this.lobbyContainer.add(mg);
      this.lobbyContainer.add(this.add.text(mx, modeY + 15, `${mode} Arena`, { fontSize: "16px", color: selected ? CORAL_HEX : TEXT, fontStyle: "bold", fontFamily: HEADING }).setOrigin(0.5));
      this.lobbyContainer.add(this.add.text(mx, modeY + 35, desc, { fontSize: "10px", color: selected ? TEXT : DIM }).setOrigin(0.5));
      if (isHost) {
        const hit = this.add.rectangle(mx, modeY + 26, 220, 52, 0, 0).setInteractive({ useHandCursor: true });
        hit.on("pointerdown", () => socket.emit("selectGamemode", mode));
        this.lobbyContainer.add(hit);
      }
    });

    // Player list
    const listY = 155;
    const cardW = Math.min(440, w - 60);
    room.players.forEach((player, i) => {
      const py = listY + i * 56;
      const isMe = player.id === socket.id;
      const pg2 = this.add.graphics();
      pg2.fillStyle(isMe ? 0x151628 : CARD, 1);
      pg2.fillRoundedRect(cx - cardW / 2, py, cardW, 48, 10);
      pg2.lineStyle(1, isMe ? CORAL : CARD_BORDER, isMe ? 0.4 : 0.15);
      pg2.strokeRoundedRect(cx - cardW / 2, py, cardW, 48, 10);
      this.lobbyContainer.add(pg2);

      // Player number circle
      const circleX = cx - cardW / 2 + 28;
      pg2.fillStyle(isMe ? CORAL : CARD_BORDER, isMe ? 0.8 : 0.5);
      pg2.fillCircle(circleX, py + 24, 14);
      this.lobbyContainer.add(this.add.text(circleX, py + 24, `${i + 1}`, { fontSize: "13px", color: WHITE, fontStyle: "bold", fontFamily: HEADING }).setOrigin(0.5));

      // Name
      this.lobbyContainer.add(this.add.text(cx - cardW / 2 + 54, py + 24, player.name, { fontSize: "16px", color: isMe ? WHITE : TEXT, fontStyle: isMe ? "bold" : "normal", fontFamily: MONO }).setOrigin(0, 0.5));

      if (player.isHost) {
        const hg = this.add.graphics();
        hg.fillStyle(CORAL, 0.15); hg.fillRoundedRect(cx + cardW / 2 - 70, py + 14, 54, 20, 10);
        hg.lineStyle(1, CORAL, 0.3); hg.strokeRoundedRect(cx + cardW / 2 - 70, py + 14, 54, 20, 10);
        this.lobbyContainer.add(hg);
        this.lobbyContainer.add(this.add.text(cx + cardW / 2 - 43, py + 24, "HOST", { fontSize: "9px", color: CORAL_HEX, fontStyle: "bold", fontFamily: HEADING }).setOrigin(0.5));
      }
    });

    // Start button / waiting text
    const bottomY = listY + room.players.length * 56 + 20;
    const minPlayers = room.gameMode === "FFA" ? 2 : 4;
    const canStart = room.players.length >= minPlayers && (room.gameMode === "FFA" || room.players.length % 2 === 0);

    if (isHost) {
      if (canStart) {
        this.lobbyContainer.add(this.makePill(cx, bottomY + 24, 260, 50, "START GAME", "solid", () => socket.emit("startGame")));
      } else {
        const reason = room.gameMode === "Duo" && room.players.length % 2 !== 0 ? "Even players needed" : `Need ${minPlayers}+ players`;
        const dg2 = this.add.graphics();
        dg2.fillStyle(CARD, 1); dg2.fillRoundedRect(cx - 130, bottomY, 260, 50, 25);
        dg2.lineStyle(1, CARD_BORDER, 0.3); dg2.strokeRoundedRect(cx - 130, bottomY, 260, 50, 25);
        this.lobbyContainer.add(dg2);
        this.lobbyContainer.add(this.add.text(cx, bottomY + 25, "START GAME", { fontSize: "15px", color: DIM, fontStyle: "bold", fontFamily: HEADING }).setOrigin(0.5));
        this.lobbyContainer.add(this.add.text(cx, bottomY + 58, reason, { fontSize: "10px", color: DIM }).setOrigin(0.5));
      }
    } else {
      this.lobbyContainer.add(this.add.text(cx, bottomY + 24, "Waiting for host to start...", { fontSize: "14px", color: DIM }).setOrigin(0.5));
    }
  }

  // ── Pill button ──
  private makePill(x: number, y: number, w: number, h: number, label: string, style: "solid" | "outline", onClick: () => void): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const gfx = this.add.graphics();
    const r = h / 2;
    const draw = (fill: number, fillA: number, stroke: number, strokeA: number) => {
      gfx.clear();
      if (fillA > 0) { gfx.fillStyle(fill, fillA); gfx.fillRoundedRect(-w / 2, -h / 2, w, h, r); }
      if (strokeA > 0) { gfx.lineStyle(2, stroke, strokeA); gfx.strokeRoundedRect(-w / 2, -h / 2, w, h, r); }
    };
    if (style === "solid") draw(CORAL, 1, 0, 0);
    else draw(CARD, 1, CORAL, 0.7);

    const text = this.add.text(0, 0, label, { fontSize: "15px", color: WHITE, fontStyle: "bold", fontFamily: HEADING }).setOrigin(0.5);
    const hit = this.add.rectangle(0, 0, w, h, 0, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerover", () => { if (style === "solid") draw(0xff8866, 1, 0, 0); else draw(CORAL, 0.12, CORAL, 1); });
    hit.on("pointerout", () => { if (style === "solid") draw(CORAL, 1, 0, 0); else draw(CARD, 1, CORAL, 0.7); });
    hit.on("pointerdown", onClick);
    container.add([gfx, text, hit]);
    return container;
  }

  private errorText: Phaser.GameObjects.Text | null = null;
  private showError(msg: string): void {
    if (this.errorText) this.errorText.destroy();
    this.errorText = this.add.text(this.cameras.main.centerX, this.cameras.main.height - 55, msg, { fontSize: "13px", color: "#ff4444", fontFamily: HEADING }).setOrigin(0.5).setDepth(100);
    this.time.delayedCall(3000, () => { this.errorText?.destroy(); this.errorText = null; });
  }

  shutdown(): void {
    socket.off("roomState"); socket.off("error"); socket.off("connect"); socket.off("connect_error" as never);
    this.input.keyboard!.off("keydown");
  }
}
