import { describe, it, expect, beforeEach } from "vitest";
import {
  createRoom,
  joinRoom,
  leaveRoom,
  selectGamemode,
  startGame,
  resetRoom,
  getRoomForPlayer,
  getRoomByCode,
} from "./rooms.js";

// Each test starts fresh — rooms module has module-level state, so we
// rely on leaveRoom / natural cleanup.  We use unique player IDs per test.
let uid = 0;
function pid(): string {
  return `p${++uid}`;
}

describe("rooms", () => {
  // ── createRoom ──
  describe("createRoom", () => {
    it("creates a room with a 4-digit code", () => {
      const host = pid();
      const room = createRoom(host, "Alice");
      expect(room.code).toMatch(/^\d{4}$/);
      expect(room.hostId).toBe(host);
      expect(room.players).toHaveLength(1);
      expect(room.players[0].isHost).toBe(true);
      expect(room.started).toBe(false);
      expect(room.gameMode).toBe("FFA");
    });

    it("uses player id prefix when name is empty", () => {
      const host = pid();
      const room = createRoom(host, "");
      expect(room.players[0].name).toBe(host.slice(0, 6));
    });

    it("removes player from previous room before creating new one", () => {
      const host = pid();
      const room1 = createRoom(host, "Alice");
      const room2 = createRoom(host, "Alice");
      expect(room2.code).not.toBe(room1.code);
      expect(getRoomByCode(room1.code)).toBeNull();
    });
  });

  // ── joinRoom ──
  describe("joinRoom", () => {
    it("lets a player join an existing room", () => {
      const host = pid();
      const joiner = pid();
      const room = createRoom(host, "Host");
      const result = joinRoom(joiner, room.code, "Joiner");
      expect("room" in result).toBe(true);
      if ("room" in result) {
        expect(result.room.players).toHaveLength(2);
        expect(result.room.players[1].name).toBe("Joiner");
        expect(result.room.players[1].isHost).toBe(false);
      }
    });

    it("returns error for non-existent room", () => {
      const result = joinRoom(pid(), "9999", "Test");
      expect("error" in result).toBe(true);
    });

    it("returns error when game already started", () => {
      const host = pid();
      const room = createRoom(host, "Host");
      joinRoom(pid(), room.code, "P2");
      startGame(host);
      const result = joinRoom(pid(), room.code, "Late");
      expect("error" in result).toBe(true);
      if ("error" in result) expect(result.error).toContain("already started");
    });

    it("returns error when room is full (6 players)", () => {
      const host = pid();
      const room = createRoom(host, "Host");
      for (let i = 0; i < 5; i++) joinRoom(pid(), room.code, `P${i}`);
      const result = joinRoom(pid(), room.code, "Extra");
      expect("error" in result).toBe(true);
      if ("error" in result) expect(result.error).toContain("full");
    });

    it("returns error if player already in room", () => {
      const host = pid();
      const room = createRoom(host, "Host");
      const result = joinRoom(host, room.code, "Host");
      expect("error" in result).toBe(true);
    });
  });

  // ── leaveRoom ──
  describe("leaveRoom", () => {
    it("returns null when player is not in any room", () => {
      expect(leaveRoom("nonexistent")).toBeNull();
    });

    it("removes player and reassigns host", () => {
      const host = pid();
      const p2 = pid();
      const room = createRoom(host, "Host");
      joinRoom(p2, room.code, "P2");

      const result = leaveRoom(host);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.room.hostId).toBe(p2);
        expect(result.room.players[0].isHost).toBe(true);
        expect(result.room.players).toHaveLength(1);
      }
    });

    it("deletes room when last player leaves", () => {
      const host = pid();
      const room = createRoom(host, "Host");
      const code = room.code;
      leaveRoom(host);
      expect(getRoomByCode(code)).toBeNull();
    });
  });

  // ── selectGamemode ──
  describe("selectGamemode", () => {
    it("host can change gamemode", () => {
      const host = pid();
      const room = createRoom(host, "Host");
      const result = selectGamemode(host, "Duo");
      expect(result).not.toBeNull();
      if (result && !("error" in result)) {
        expect(result.gameMode).toBe("Duo");
      }
    });

    it("non-host cannot change gamemode", () => {
      const host = pid();
      const p2 = pid();
      const room = createRoom(host, "Host");
      joinRoom(p2, room.code, "P2");
      const result = selectGamemode(p2, "Duo");
      expect(result).not.toBeNull();
      if (result && "error" in result) {
        expect(result.error).toContain("host");
      }
    });

    it("returns null for unknown player", () => {
      expect(selectGamemode("nobody", "FFA")).toBeNull();
    });
  });

  // ── startGame ──
  describe("startGame", () => {
    it("starts FFA game with 2+ players", () => {
      const host = pid();
      const room = createRoom(host, "Host");
      joinRoom(pid(), room.code, "P2");
      const result = startGame(host);
      expect("error" in result).toBe(false);
      if (!("error" in result)) {
        expect(result.started).toBe(true);
        // FFA: each player gets unique team
        expect(result.players[0].team).toBe(1);
        expect(result.players[1].team).toBe(2);
      }
    });

    it("rejects FFA with only 1 player", () => {
      const host = pid();
      createRoom(host, "Host");
      const result = startGame(host);
      expect("error" in result).toBe(true);
    });

    it("rejects Duo with fewer than 4 players", () => {
      const host = pid();
      const room = createRoom(host, "Host");
      joinRoom(pid(), room.code, "P2");
      selectGamemode(host, "Duo");
      const result = startGame(host);
      expect("error" in result).toBe(true);
    });

    it("rejects Duo with odd player count", () => {
      const host = pid();
      const room = createRoom(host, "Host");
      joinRoom(pid(), room.code, "P2");
      joinRoom(pid(), room.code, "P3");
      joinRoom(pid(), room.code, "P4");
      joinRoom(pid(), room.code, "P5");
      selectGamemode(host, "Duo");
      const result = startGame(host);
      expect("error" in result).toBe(true);
      if ("error" in result) expect(result.error).toContain("even");
    });

    it("assigns Duo teams correctly (pairs of 2)", () => {
      const host = pid();
      const room = createRoom(host, "Host");
      joinRoom(pid(), room.code, "P2");
      joinRoom(pid(), room.code, "P3");
      joinRoom(pid(), room.code, "P4");
      selectGamemode(host, "Duo");
      const result = startGame(host);
      if (!("error" in result)) {
        expect(result.players[0].team).toBe(1);
        expect(result.players[1].team).toBe(1);
        expect(result.players[2].team).toBe(2);
        expect(result.players[3].team).toBe(2);
      }
    });

    it("only host can start", () => {
      const host = pid();
      const p2 = pid();
      const room = createRoom(host, "Host");
      joinRoom(p2, room.code, "P2");
      const result = startGame(p2);
      expect("error" in result).toBe(true);
      if ("error" in result) expect(result.error).toContain("host");
    });
  });

  // ── resetRoom ──
  describe("resetRoom", () => {
    it("resets started flag and teams", () => {
      const host = pid();
      const room = createRoom(host, "Host");
      joinRoom(pid(), room.code, "P2");
      startGame(host);
      const reset = resetRoom(room.code);
      expect(reset).not.toBeNull();
      if (reset) {
        expect(reset.started).toBe(false);
        expect(reset.gameMode).toBe("FFA");
        expect(reset.players.every((p) => p.team === 0)).toBe(true);
      }
    });

    it("returns null for non-existent room", () => {
      expect(resetRoom("0000")).toBeNull();
    });
  });

  // ── getRoomForPlayer / getRoomByCode ──
  describe("lookup functions", () => {
    it("getRoomForPlayer returns the room", () => {
      const host = pid();
      const room = createRoom(host, "Host");
      expect(getRoomForPlayer(host)?.code).toBe(room.code);
    });

    it("getRoomForPlayer returns null for unknown player", () => {
      expect(getRoomForPlayer("ghost")).toBeNull();
    });

    it("getRoomByCode returns the room", () => {
      const host = pid();
      const room = createRoom(host, "Host");
      expect(getRoomByCode(room.code)?.code).toBe(room.code);
    });

    it("getRoomByCode returns null for unknown code", () => {
      expect(getRoomByCode("0000")).toBeNull();
    });
  });
});
