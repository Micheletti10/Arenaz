import Phaser from "phaser";
import { socket } from "../network";
import type { GameOverData } from "@arenaz/types";
import { FFA_TEAM_COLORS } from "@arenaz/types/src/constants";

const BG = 0x0a0b14;
const CARD = 0x12131f;
const CARD_BORDER = 0x1e2035;
const CORAL = "#ff6b4a";
const CORAL_NUM = 0xff6b4a;
const GOLD = "#ffd700";
const WHITE = "#ffffff";
const DIM = "#666680";
const TEXT = "#c8c8d8";
const HEADING_FONT = "'Arial Black', Impact, sans-serif";
const MONO_FONT = "'Courier New', monospace";

export class GameOverScene extends Phaser.Scene {
  constructor() { super({ key: "GameOverScene" }); }

  create(sceneData: { data: GameOverData }) {
    this.cameras.main.setZoom(1).setBackgroundColor(BG);
    const { data } = sceneData;
    const cx = this.cameras.main.centerX;
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    const cardW = Math.min(600, w - 60);
    const cardH = Math.min(500, h - 80);
    const cardY = Math.max(40, (h - cardH) / 2);
    const g = this.add.graphics();
    g.fillStyle(CARD, 1); g.fillRoundedRect(cx - cardW / 2, cardY, cardW, cardH, 16);
    g.lineStyle(1, CARD_BORDER, 0.5); g.strokeRoundedRect(cx - cardW / 2, cardY, cardW, cardH, 16);

    let y = cardY + 30;
    this.add.text(cx, y, "MATCH OVER", { fontSize: "32px", color: CORAL, fontStyle: "bold", fontFamily: HEADING_FONT }).setOrigin(0.5);
    y += 50;

    // Team placements
    for (const tp of data.teamPlacements.sort((a, b) => a.placement - b.placement)) {
      const tc = FFA_TEAM_COLORS[(tp.teamNumber - 1) % FFA_TEAM_COLORS.length];
      const colorHex = `#${tc.toString(16).padStart(6, "0")}`;
      const isWinner = tp.placement === 1;
      const label = isWinner ? "1st" : tp.placement === 2 ? "2nd" : tp.placement === 3 ? "3rd" : `${tp.placement}th`;
      this.add.text(cx - 80, y, label, { fontSize: isWinner ? "22px" : "16px", color: isWinner ? GOLD : TEXT, fontStyle: "bold", fontFamily: HEADING_FONT }).setOrigin(1, 0);
      this.add.text(cx - 60, y + 2, `Team ${tp.teamNumber}`, { fontSize: "14px", color: colorHex, fontStyle: "bold" });
      this.add.text(cx + 60, y + 2, `${tp.health} HP`, { fontSize: "14px", color: tp.health > 0 ? TEXT : DIM });
      y += 28;
    }
    y += 10;

    // Player stats table
    const sorted = [...data.players].sort((a, b) => a.placement - b.placement || b.kills - a.kills);
    const tableX = cx - cardW / 2 + 20;
    const hdr = { fontSize: "10px", color: DIM, fontStyle: "bold" as const, fontFamily: HEADING_FONT };
    this.add.text(tableX, y, "PLAYER", hdr);
    this.add.text(tableX + 120, y, "TEAM", hdr);
    this.add.text(tableX + 180, y, "K", hdr);
    this.add.text(tableX + 220, y, "D", hdr);
    this.add.text(tableX + 260, y, "DMG", hdr);
    y += 18;

    sorted.forEach((p) => {
      const isMe = p.id === socket.id;
      const s = { fontSize: "13px", color: isMe ? WHITE : TEXT, fontStyle: (isMe ? "bold" : "normal") as "bold" | "normal" };
      this.add.text(tableX, y, p.name, { ...s, fontFamily: MONO_FONT });
      const tc = FFA_TEAM_COLORS[(p.team - 1) % FFA_TEAM_COLORS.length];
      this.add.text(tableX + 120, y, `${p.team}`, { ...s, color: `#${tc.toString(16).padStart(6, "0")}` });
      this.add.text(tableX + 180, y, String(p.kills), s);
      this.add.text(tableX + 220, y, String(p.deaths), s);
      this.add.text(tableX + 260, y, String(p.damageDealt), s);
      y += 20;
    });

    // Return button
    const btnY = cardY + cardH - 50;
    const bg2 = this.add.graphics();
    bg2.fillStyle(CORAL_NUM, 1); bg2.fillRoundedRect(cx - 120, btnY, 240, 40, 20);
    this.add.text(cx, btnY + 20, "RETURN TO LOBBY", { fontSize: "14px", color: WHITE, fontStyle: "bold", fontFamily: HEADING_FONT }).setOrigin(0.5);
    const hit = this.add.rectangle(cx, btnY + 20, 240, 40, 0, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => this.scene.start("LobbyScene"));
  }

  shutdown() { this.input.off("pointerdown"); }
}
