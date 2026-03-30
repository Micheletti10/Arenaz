import type {
  RoomState,
  LobbyPlayer,
  CharacterType,
  GameMode,
  Team,
} from "@arenaz/types";
import { MAX_PLAYERS, MIN_PLAYERS, ROOM_CODE_LENGTH } from "@arenaz/types/src/constants.js";

// All rooms keyed by room code
const rooms: Map<string, RoomState> = new Map();

// Track which room each socket is in
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
  const host: LobbyPlayer = {
    id: playerId,
    name: name || playerId.slice(0, 6),
    character: null,
    team: 0,
    isHost: true,
  };

  const room: RoomState = {
    code,
    hostId: playerId,
    gameMode: "Deathmatch",
    players: [host],
    started: false,
  };

  rooms.set(code, room);
  playerRoomMap.set(playerId, code);
  return room;
}

export function joinRoom(
  playerId: string,
  code: string,
  name: string
): { room: RoomState } | { error: string } {
  const room = rooms.get(code);
  if (!room) return { error: "Room not found" };
  if (room.started) return { error: "Game already started" };
  if (room.players.length >= MAX_PLAYERS) return { error: "Room is full" };
  if (room.players.some((p) => p.id === playerId)) return { error: "Already in room" };

  leaveRoom(playerId);

  const player: LobbyPlayer = {
    id: playerId,
    name: name || playerId.slice(0, 6),
    character: null,
    team: 0,
    isHost: false,
  };

  room.players.push(player);
  playerRoomMap.set(playerId, code);
  return { room };
}

export function leaveRoom(playerId: string): { room: RoomState; removed: true } | null {
  const code = playerRoomMap.get(playerId);
  if (!code) return null;

  const room = rooms.get(code);
  if (!room) {
    playerRoomMap.delete(playerId);
    return null;
  }

  room.players = room.players.filter((p) => p.id !== playerId);
  playerRoomMap.delete(playerId);

  // If room is empty, delete it
  if (room.players.length === 0) {
    rooms.delete(code);
    return null;
  }

  // If host left, promote next player
  if (room.hostId === playerId) {
    room.hostId = room.players[0].id;
    room.players[0].isHost = true;
  }

  return { room, removed: true };
}

export function selectCharacter(
  playerId: string,
  character: CharacterType
): RoomState | null {
  const room = getRoomForPlayer(playerId);
  if (!room || room.started) return null;

  const player = room.players.find((p) => p.id === playerId);
  if (!player) return null;

  player.character = character;
  return room;
}

export function selectGamemode(
  playerId: string,
  mode: GameMode
): RoomState | { error: string } | null {
  const room = getRoomForPlayer(playerId);
  if (!room || room.started) return null;
  if (room.hostId !== playerId) return { error: "Only the host can change gamemode" };

  room.gameMode = mode;

  // Reset teams if switching to Deathmatch
  if (mode === "Deathmatch") {
    for (const p of room.players) {
      p.team = 0;
    }
  }

  return room;
}

export function assignTeam(
  hostId: string,
  targetPlayerId: string,
  team: Team
): RoomState | { error: string } | null {
  const room = getRoomForPlayer(hostId);
  if (!room || room.started) return null;
  if (room.hostId !== hostId) return { error: "Only the host can assign teams" };
  if (room.gameMode !== "TeamDeathmatch") return { error: "Teams only in TeamDeathmatch" };

  const target = room.players.find((p) => p.id === targetPlayerId);
  if (!target) return { error: "Player not in room" };

  target.team = team;
  return room;
}

export function startGame(
  playerId: string
): RoomState | { error: string } {
  const room = getRoomForPlayer(playerId);
  if (!room) return { error: "Not in a room" };
  if (room.started) return { error: "Game already started" };
  if (room.hostId !== playerId) return { error: "Only the host can start" };
  if (room.players.length < MIN_PLAYERS) return { error: `Need at least ${MIN_PLAYERS} players` };

  // Check all players picked a character
  const unpicked = room.players.filter((p) => p.character === null);
  if (unpicked.length > 0) return { error: "All players must pick a character" };

  // In TeamDeathmatch, check all players have a team
  if (room.gameMode === "TeamDeathmatch") {
    const unassigned = room.players.filter((p) => p.team === 0);
    if (unassigned.length > 0) return { error: "All players must be assigned a team" };
  }

  room.started = true;
  return room;
}

export function resetRoom(code: string): RoomState | null {
  const room = rooms.get(code);
  if (!room) return null;
  room.started = false;
  // Reset character picks and teams for a fresh lobby
  for (const p of room.players) {
    p.character = null;
    p.team = 0;
  }
  room.gameMode = "Deathmatch";
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
