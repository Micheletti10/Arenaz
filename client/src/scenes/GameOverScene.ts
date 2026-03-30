import Phaser from "phaser";
import { socket } from "../network";
import type { GameOverData } from "@arenaz/types";

const BG = 0x0a0b14;
const CARD = 0x12131f;
const CARD_BORDER = 0x1e2035;
const CORAL = "#ff6b4a";
const CORAL_NUM = 0xff6b4a;
const GOLD = "#ffd700";
const GOLD_NUM = 0xffd700;
const WHITE = "#ffffff";
const TEXT = "#c8c8d8";
const DIM = "#666680";
const HEADING_FONT = "'Arial Black', Impact, sans-serif";
const MONO_FONT = "'Courier New', monospace";

const CHAR_COLORS: Record<string, string> = {
  Bruiser: "#e74c3c",
  Phantom: "#9b59b6",
  Warden: "#2ecc71",
};

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: "GameOverScene" });
  }

  create(sceneData: { data: GameOverData }) {
    this.cameras.main.setZoom(1);
    this.cameras.main.setBackgroundColor(BG);

    const { data } = sceneData;
    const cx = this.cameras.main.centerX;
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    // Particle background
    for (let i = 0; i < 30; i++) {
      const dot = this.add.circle(
        Phaser.Math.Between(0, w), Phaser.Math.Between(0, h),
        Phaser.Math.Between(1, 2), 0xffffff, Phaser.Math.FloatBetween(0.02, 0.08)
      );
      this.tweens.add({
        targets: dot,
        x: dot.x + Phaser.Math.Between(-80, 80),
        y: dot.y + Phaser.Math.Between(-40, 40),
        alpha: { from: dot.alpha, to: Phaser.Math.FloatBetween(0.01, 0.06) },
        duration: Phaser.Math.Between(4000, 9000),
        yoyo: true, repeat: -1, ease: "Sine.easeInOut",
      });
    }

    // Main content card
    const cardW = Math.min(600, w - 60);
    const cardH = Math.min(500, h - 80);
    const cardY = Math.max(40, (h - cardH) / 2);
    const g = this.add.graphics();
    g.fillStyle(CARD, 1);
    g.fillRoundedRect(cx - cardW / 2, cardY, cardW, cardH, 16);
    g.lineStyle(1, CARD_BORDER, 0.5);
    g.strokeRoundedRect(cx - cardW / 2, cardY, cardW, cardH, 16);

    let y = cardY + 30;

    // Title
    this.add.text(cx, y, "MATCH OVER", {
      fontSize: "32px", color: CORAL, fontStyle: "bold", fontFamily: HEADING_FONT,
    }).setOrigin(0.5);
    y += 44;

    // Duration pill
    const durSecs = Math.round(data.matchDurationMs / 1000);
    const durStr = `${Math.floor(durSecs / 60)}:${(durSecs % 60).toString().padStart(2, "0")}`;
    const durG = this.add.graphics();
    durG.fillStyle(0x0a0b14, 0.8);
    durG.fillRoundedRect(cx - 60, y - 2, 120, 22, 11);
    this.add.text(cx, y + 9, durStr, { fontSize: "12px", color: DIM, fontFamily: MONO_FONT }).setOrigin(0.5);
    y += 30;

    // TDM team scores
    if (data.gameMode === "TeamDeathmatch") {
      const rk = data.players.filter((p) => p.team === 1).reduce((s, p) => s + p.kills, 0);
      const bk = data.players.filter((p) => p.team === 2).reduce((s, p) => s + p.kills, 0);
      const rWin = rk > bk;
      const bWin = bk > rk;

      this.add.text(cx - 60, y, String(rk), {
        fontSize: "28px", color: rWin ? "#ff4444" : "#663333", fontStyle: "bold", fontFamily: HEADING_FONT,
      }).setOrigin(1, 0);
      this.add.text(cx - 68, y + 6, "RED", { fontSize: "10px", color: "#ff6666", fontFamily: HEADING_FONT }).setOrigin(1, 0);

      this.add.text(cx, y + 4, "—", { fontSize: "18px", color: DIM }).setOrigin(0.5, 0);

      this.add.text(cx + 60, y, String(bk), {
        fontSize: "28px", color: bWin ? "#4a9eff" : "#333366", fontStyle: "bold", fontFamily: HEADING_FONT,
      }).setOrigin(0, 0);
      this.add.text(cx + 68, y + 6, "BLUE", { fontSize: "10px", color: "#6699ff", fontFamily: HEADING_FONT }).setOrigin(0, 0);
      y += 44;
    }

    // MVP
    const mvp = [...data.players].sort((a, b) => b.kills - a.kills)[0];
    if (mvp) {
      const isMvpMe = mvp.id === socket.id;
      // Gold accent bar
      const mvpG = this.add.graphics();
      mvpG.fillStyle(GOLD_NUM, 0.1);
      mvpG.fillRoundedRect(cx - cardW / 2 + 20, y - 4, cardW - 40, 32, 8);
      mvpG.lineStyle(1, GOLD_NUM, 0.3);
      mvpG.strokeRoundedRect(cx - cardW / 2 + 20, y - 4, cardW - 40, 32, 8);

      this.add.text(cx - cardW / 2 + 32, y + 4, "MVP", {
        fontSize: "11px", color: GOLD, fontStyle: "bold", fontFamily: HEADING_FONT,
      });
      this.add.text(cx, y + 4, `${mvp.id.slice(0, 6)}  —  ${mvp.kills} kills`, {
        fontSize: "14px", color: GOLD, fontStyle: "bold", fontFamily: HEADING_FONT,
      }).setOrigin(0.5, 0);
      if (isMvpMe) {
        this.add.text(cx + cardW / 2 - 32, y + 6, "YOU!", {
          fontSize: "11px", color: GOLD, fontStyle: "bold", fontFamily: HEADING_FONT,
        }).setOrigin(1, 0);
      }
      y += 42;
    }

    // Table
    const tableW = cardW - 40;
    const tableX = cx - tableW / 2;
    const cols = {
      name: tableX + 10,
      char: tableX + tableW * 0.22,
      kills: tableX + tableW * 0.42,
      deaths: tableX + tableW * 0.55,
      kd: tableX + tableW * 0.68,
      dmg: tableX + tableW * 0.82,
    };

    // Header row
    const hdrG = this.add.graphics();
    hdrG.fillStyle(0x0a0b14, 0.5);
    hdrG.fillRoundedRect(tableX, y, tableW, 22, { tl: 6, tr: 6, bl: 0, br: 0 });
    const hdrStyle = { fontSize: "10px", color: DIM, fontStyle: "bold" as const, fontFamily: HEADING_FONT };
    this.add.text(cols.name, y + 5, "PLAYER", hdrStyle);
    this.add.text(cols.char, y + 5, "CHAR", hdrStyle);
    this.add.text(cols.kills, y + 5, "KILLS", hdrStyle);
    this.add.text(cols.deaths, y + 5, "DEATHS", hdrStyle);
    this.add.text(cols.kd, y + 5, "K/D", hdrStyle);
    this.add.text(cols.dmg, y + 5, "DMG", hdrStyle);
    y += 24;

    // Player rows
    const sorted = [...data.players].sort((a, b) => b.kills - a.kills);
    sorted.forEach((p, i) => {
      const ry = y + i * 30;
      const isMe = p.id === socket.id;
      const isMvpRow = mvp && p.id === mvp.id;

      // Alternating row background
      const rowG = this.add.graphics();
      if (i % 2 === 0) {
        rowG.fillStyle(0x0a0b14, 0.3);
        rowG.fillRect(tableX, ry, tableW, 28);
      }
      if (isMe) {
        rowG.lineStyle(1, CORAL_NUM, 0.3);
        rowG.strokeRoundedRect(tableX, ry, tableW, 28, 4);
      }

      let rowColor = isMe ? WHITE : TEXT;
      if (data.gameMode === "TeamDeathmatch") {
        rowColor = p.team === 1 ? (isMe ? "#ff8888" : "#cc6666") : (isMe ? "#88bbff" : "#6699cc");
      }

      const style = { fontSize: "13px", color: rowColor, fontStyle: (isMe ? "bold" : "normal") as "bold" | "normal" };
      const prefix = isMvpRow ? "* " : isMe ? "> " : "  ";
      const kd = p.deaths === 0 ? p.kills.toFixed(1) : (p.kills / p.deaths).toFixed(1);

      this.add.text(cols.name, ry + 6, prefix + p.id.slice(0, 6), { ...style, fontFamily: MONO_FONT });
      this.add.text(cols.char, ry + 6, p.character, { ...style, color: CHAR_COLORS[p.character] ?? rowColor, fontFamily: HEADING_FONT, fontSize: "12px" });
      this.add.text(cols.kills, ry + 6, String(p.kills), style);
      this.add.text(cols.deaths, ry + 6, String(p.deaths), style);
      this.add.text(cols.kd, ry + 6, kd, style);
      this.add.text(cols.dmg, ry + 6, String(p.damageDealt), style);
    });

    // Return button (pill, coral style)
    const btnY = cardY + cardH - 50;
    const btnW = 240;
    const btnH = 40;
    const btnG = this.add.graphics();
    btnG.fillStyle(CORAL_NUM, 1);
    btnG.fillRoundedRect(cx - btnW / 2, btnY, btnW, btnH, btnH / 2);
    this.add.text(cx, btnY + btnH / 2, "RETURN TO LOBBY", {
      fontSize: "14px", color: WHITE, fontStyle: "bold", fontFamily: HEADING_FONT,
    }).setOrigin(0.5);

    const btnHit = this.add.rectangle(cx, btnY + btnH / 2, btnW, btnH, 0, 0).setInteractive({ useHandCursor: true });
    btnHit.on("pointerover", () => { btnG.clear(); btnG.fillStyle(0xff8866, 1); btnG.fillRoundedRect(cx - btnW / 2, btnY, btnW, btnH, btnH / 2); });
    btnHit.on("pointerout", () => { btnG.clear(); btnG.fillStyle(CORAL_NUM, 1); btnG.fillRoundedRect(cx - btnW / 2, btnY, btnW, btnH, btnH / 2); });
    btnHit.on("pointerdown", () => this.scene.start("LobbyScene"));
  }

  shutdown() {
    this.input.off("pointerdown");
  }
}
