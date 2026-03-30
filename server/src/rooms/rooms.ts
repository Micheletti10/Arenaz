import type {
  RoomState,
  LobbyPlayer,
  GameMode,
} from "@arenaz/types";
import { MAX_PLAYERS, MIN_PLAYERS } from "@arenaz/types/src/constants.js";

const rooms: Map<string, RoomState> = new Map();
const playerRoomMap: Map<string, string> = new Map();

function generateCode(): string {
  let code: string;
  do {
    code = String(Math.floor(1000 + Math.random() * 9000));
  } while (rooms.has(code));
  return code;
}

export function createRoom(playerId: string, name: string): RoomState {
  leaveRoom(playerId);
  const code = generateCode();
  const room: RoomState = {
    code,
    hostId: playerId,
    gameMode: "FFA",
    players: [{ id: playerId, name: name || playerId.slice(0, 6), team: 0, isHost: true }],
    started: false,
  };
  rooms.set(code, room);
  playerRoomMap.set(playerId, code);
  return room;
}

export function joinRoom(playerId: string, code: string, name: string): { room: RoomState } | { error: string } {
  const room = rooms.get(code);
  if (!room) return { error: "Room not found" };
  if (room.started) return { error: "Game already started" };
  if (room.players.length >= MAX_PLAYERS) return { error: "Room is full" };
  if (room.players.some((p) => p.id === playerId)) return { error: "Already in room" };
  leaveRoom(playerId);
  room.players.push({ id: playerId, name: name || playerId.slice(0, 6), team: 0, isHost: false });
  playerRoomMap.set(playerId, code);
  return { room };
}

export function leaveRoom(playerId: string): { room: RoomState; removed: true } | null {
  const code = playerRoomMap.get(playerId);
  if (!code) return null;
  const room = rooms.get(code);
  if (!room) { playerRoomMap.delete(playerId); return null; }
  room.players = room.players.filter((p) => p.id !== playerId);
  playerRoomMap.delete(playerId);
  if (room.players.length === 0) { rooms.delete(code); return null; }
  if (room.hostId === playerId) {
    room.hostId = room.players[0].id;
    room.players[0].isHost = true;
  }
  return { room, removed: true };
}

export function selectGamemode(playerId: string, mode: GameMode): RoomState | { error: string } | null {
  const room = getRoomForPlayer(playerId);
  if (!room || room.started) return null;
  if (room.hostId !== playerId) return { error: "Only the host can change gamemode" };
  room.gameMode = mode;
  return room;
}

function autoAssignTeams(room: RoomState): void {
  if (room.gameMode === "FFA") {
    // Each player gets a unique team 1-6
    room.players.forEach((p, i) => { p.team = i + 1; });
  } else {
    // Duo: pair players into teams. First 2 = team 1, next 2 = team 2, etc.
    room.players.forEach((p, i) => { p.team = Math.floor(i / 2) + 1; });
  }
}

export function startGame(playerId: string): RoomState | { error: string } {
  const room = getRoomForPlayer(playerId);
  if (!room) return { error: "Not in a room" };
  if (room.started) return { error: "Game already started" };
  if (room.hostId !== playerId) return { error: "Only the host can start" };

  if (room.gameMode === "FFA") {
    if (room.players.length < 2) return { error: "Need at least 2 players for FFA" };
  } else {
    if (room.players.length < 4) return { error: "Need at least 4 players for Duo" };
    if (room.players.length % 2 !== 0) return { error: "Duo mode requires even number of players" };
  }

  autoAssignTeams(room);
  room.started = true;
  return room;
}

export function resetRoom(code: string): RoomState | null {
  const room = rooms.get(code);
  if (!room) return null;
  room.started = false;
  room.gameMode = "FFA";
  for (const p of room.players) { p.team = 0; }
  return room;
}

export function getRoomForPlayer(playerId: string): RoomState | null {
  const code = playerRoomMap.get(playerId);
  if (!code) return null;
  return rooms.get(code) ?? null;
}

export function getRoomByCode(code: string): RoomState | null {
  return rooms.get(code) ?? null;
}
