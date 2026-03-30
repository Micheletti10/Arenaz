import Phaser from "phaser";
import { socket } from "../network";
import type { RoomState, GameMode } from "@arenaz/types";

const MODES: GameMode[] = ["FFA", "Duo"];

const BG = 0x0a0b14;
const CARD = 0x12131f;
const CARD_BORDER = 0x1e2035;
const CORAL = 0xff6b4a;
const CORAL_HEX = "#ff6b4a";
const WHITE = "#ffffff";
const DIM = "#666680";
const TEXT = "#c8c8d8";

const HEADING_FONT = "'Arial Black', Impact, sans-serif";
const MONO_FONT = "'Courier New', monospace";

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

  constructor() { super({ key: "LobbyScene" }); }

  create() {
    this.cameras.main.setZoom(1).setBackgroundColor(BG);
    this.uiContainer = this.add.container(0, 0).setDepth(10);
    this.buildMenuScreen();

    const cx = this.cameras.main.centerX;
    const h = this.cameras.main.height;
    this.statusText = this.add.text(cx, h - 20, "", { fontSize: "12px", color: DIM }).setOrigin(0.5).setDepth(10);

    if (!socket.connected) { this.statusText.setText("Connecting...").setColor("#ffaa00"); socket.connect(); }
    else { this.statusText.setText("Connected").setColor("#44ff44"); }

    socket.on("connect", () => this.statusText.setText("Connected").setColor("#44ff44"));
    socket.on("connect_error" as never, () => { this.statusText.setText("Cannot reach server").setColor("#ff4444"); });
    socket.on("roomState", (state) => {
      this.room = state;
      if (state.started) { this.scene.start("GameScene"); return; }
      this.showLobbyScreen();
    });
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
      this.nameText.setText(this.nameInput || "Enter name...").setColor(this.nameInput ? WHITE : DIM);
      this.codeText.setText(this.codeInput || "____").setColor(this.codeInput ? WHITE : DIM);
    });
  }

  private buildMenuScreen(): void {
    this.menuContainer = this.add.container(0, 0);
    this.uiContainer.add(this.menuContainer);
    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;

    let y = cy - 190;
    const title = this.add.text(cx, y, "ARENAZ", { fontSize: "56px", color: CORAL_HEX, fontStyle: "bold", fontFamily: HEADING_FONT }).setOrigin(0.5);
    this.menuContainer.add(title);
    this.tweens.add({ targets: title, alpha: { from: 1, to: 0.7 }, duration: 2000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    y += 50;
    this.menuContainer.add(this.add.text(cx, y, "MULTIPLAYER ARENA", { fontSize: "12px", color: DIM, fontFamily: HEADING_FONT, letterSpacing: 6 }).setOrigin(0.5));
    y += 40;

    // Name input
    this.menuContainer.add(this.add.text(cx, y, "YOUR NAME", { fontSize: "14px", color: CORAL_HEX, fontStyle: "bold", fontFamily: HEADING_FONT }).setOrigin(0.5));
    y += 24;
    const nameBg = this.add.graphics();
    nameBg.fillStyle(CARD, 1); nameBg.fillRoundedRect(cx - 120, y - 4, 240, 42, 10);
    nameBg.lineStyle(2, CORAL, 0.6); nameBg.strokeRoundedRect(cx - 120, y - 4, 240, 42, 10);
    this.menuContainer.add(nameBg);
    this.nameText = this.add.text(cx, y + 17, "Enter name...", { fontSize: "18px", color: DIM, fontFamily: MONO_FONT }).setOrigin(0.5);
    this.menuContainer.add(this.nameText);
    y += 58;

    // Create Room
    this.menuContainer.add(this.makePill(cx, y, 240, 46, "Create Room", "solid", () => {
      if (this.nameInput.length > 0) socket.emit("createRoom", this.nameInput);
      else this.showError("Enter a name first");
    }));
    y += 50;

    this.menuContainer.add(this.add.text(cx, y, "or join with code", { fontSize: "11px", color: DIM }).setOrigin(0.5));
    y += 26;

    const inputBg = this.add.graphics();
    inputBg.fillStyle(CARD, 1); inputBg.fillRoundedRect(cx - 90, y, 180, 42, 8);
    inputBg.fillStyle(CORAL, 1); inputBg.fillRect(cx - 60, y + 40, 120, 2);
    this.menuContainer.add(inputBg);
    this.codeText = this.add.text(cx, y + 21, "____", { fontSize: "22px", color: DIM, fontFamily: MONO_FONT }).setOrigin(0.5);
    this.menuContainer.add(this.codeText);
    y += 58;

    this.menuContainer.add(this.makePill(cx, y, 240, 46, "Join Room", "outline", () => {
      if (!this.nameInput) { this.showError("Enter a name first"); return; }
      if (this.codeInput.length === 4) socket.emit("joinRoom", this.codeInput, this.nameInput);
    }));
  }

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
    const g = this.add.graphics();
    g.fillStyle(CARD, 1); g.fillRoundedRect(cx - 100, 20, 200, 42, 21);
    g.lineStyle(1, CARD_BORDER, 0.6); g.strokeRoundedRect(cx - 100, 20, 200, 42, 21);
    this.lobbyContainer.add(g);
    this.lobbyContainer.add(this.add.text(cx, 41, room.code, { fontSize: "22px", color: CORAL_HEX, fontFamily: MONO_FONT, fontStyle: "bold" }).setOrigin(0.5));

    // Gamemode toggle
    const modeY = 85;
    MODES.forEach((mode, i) => {
      const mx = cx - 120 + i * 240;
      const selected = room.gameMode === mode;
      const desc = mode === "FFA" ? "Free-for-all arena" : "Teams of 2";
      const cardG = this.add.graphics();
      cardG.fillStyle(selected ? 0x1a1b2e : CARD, 1);
      cardG.fillRoundedRect(mx - 100, modeY, 200, 55, 10);
      cardG.lineStyle(2, selected ? CORAL : CARD_BORDER, selected ? 0.9 : 0.3);
      cardG.strokeRoundedRect(mx - 100, modeY, 200, 55, 10);
      this.lobbyContainer.add(cardG);
      this.lobbyContainer.add(this.add.text(mx, modeY + 16, `${mode} Arena`, { fontSize: "15px", color: selected ? CORAL_HEX : TEXT, fontStyle: "bold", fontFamily: HEADING_FONT }).setOrigin(0.5));
      this.lobbyContainer.add(this.add.text(mx, modeY + 36, desc, { fontSize: "10px", color: selected ? TEXT : DIM }).setOrigin(0.5));
      if (isHost) {
        const hit = this.add.rectangle(mx, modeY + 27, 200, 55, 0, 0).setInteractive({ useHandCursor: true });
        hit.on("pointerdown", () => socket.emit("selectGamemode", mode));
        this.lobbyContainer.add(hit);
      }
    });

    // Player list
    const listY = 160;
    const cardW = Math.min(400, w - 60);
    room.players.forEach((player, i) => {
      const py = listY + i * 52;
      const isMe = player.id === socket.id;
      const pg = this.add.graphics();
      pg.fillStyle(isMe ? 0x151628 : CARD, 1);
      pg.fillRoundedRect(cx - cardW / 2, py, cardW, 44, 8);
      pg.lineStyle(1, isMe ? CORAL : CARD_BORDER, isMe ? 0.4 : 0.2);
      pg.strokeRoundedRect(cx - cardW / 2, py, cardW, 44, 8);
      this.lobbyContainer.add(pg);
      this.lobbyContainer.add(this.add.text(cx - cardW / 2 + 16, py + 14, player.name, { fontSize: "15px", color: isMe ? WHITE : TEXT, fontStyle: isMe ? "bold" : "normal", fontFamily: MONO_FONT }));
      if (player.isHost) {
        const hg = this.add.graphics();
        hg.fillStyle(CORAL, 0.2); hg.fillRoundedRect(cx + cardW / 2 - 60, py + 12, 46, 20, 10);
        this.lobbyContainer.add(hg);
        this.lobbyContainer.add(this.add.text(cx + cardW / 2 - 37, py + 22, "HOST", { fontSize: "10px", color: CORAL_HEX, fontStyle: "bold", fontFamily: HEADING_FONT }).setOrigin(0.5));
      }
    });

    // Start button
    const bottomY = listY + room.players.length * 52 + 20;
    const minPlayers = room.gameMode === "FFA" ? 2 : 4;
    const canStart = room.players.length >= minPlayers && (room.gameMode === "FFA" || room.players.length % 2 === 0);

    if (isHost) {
      if (canStart) {
        this.lobbyContainer.add(this.makePill(cx, bottomY + 22, 240, 46, "Start Game", "solid", () => socket.emit("startGame")));
      } else {
        const reason = room.gameMode === "Duo" && room.players.length % 2 !== 0
          ? "Duo needs even players" : `Need ${minPlayers}+ players`;
        const dg = this.add.graphics();
        dg.fillStyle(CARD, 1); dg.fillRoundedRect(cx - 120, bottomY, 240, 46, 23);
        this.lobbyContainer.add(dg);
        this.lobbyContainer.add(this.add.text(cx, bottomY + 23, "Start Game", { fontSize: "15px", color: DIM, fontStyle: "bold", fontFamily: HEADING_FONT }).setOrigin(0.5));
        this.lobbyContainer.add(this.add.text(cx, bottomY + 52, reason, { fontSize: "10px", color: DIM }).setOrigin(0.5));
      }
    } else {
      this.lobbyContainer.add(this.add.text(cx, bottomY + 22, "Waiting for host...", { fontSize: "14px", color: DIM }).setOrigin(0.5));
    }
  }

  private makePill(x: number, y: number, w: number, h: number, label: string, style: "solid" | "outline", onClick: () => void): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const gfx = this.add.graphics();
    const r = h / 2;
    if (style === "solid") { gfx.fillStyle(CORAL, 1); gfx.fillRoundedRect(-w / 2, -h / 2, w, h, r); }
    else { gfx.fillStyle(CARD, 1); gfx.fillRoundedRect(-w / 2, -h / 2, w, h, r); gfx.lineStyle(2, CORAL, 0.8); gfx.strokeRoundedRect(-w / 2, -h / 2, w, h, r); }
    const text = this.add.text(0, 0, label, { fontSize: "16px", color: WHITE, fontStyle: "bold", fontFamily: HEADING_FONT }).setOrigin(0.5);
    const hit = this.add.rectangle(0, 0, w, h, 0, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", onClick);
    container.add([gfx, text, hit]);
    return container;
  }

  private errorText: Phaser.GameObjects.Text | null = null;
  private showError(msg: string): void {
    if (this.errorText) this.errorText.destroy();
    this.errorText = this.add.text(this.cameras.main.centerX, this.cameras.main.height - 50, msg, { fontSize: "13px", color: "#ff4444", fontFamily: HEADING_FONT }).setOrigin(0.5).setDepth(100);
    this.time.delayedCall(3000, () => { this.errorText?.destroy(); this.errorText = null; });
  }

  shutdown(): void {
    socket.off("roomState"); socket.off("error"); socket.off("connect"); socket.off("connect_error" as never);
    this.input.keyboard!.off("keydown");
  }
}
