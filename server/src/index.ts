import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";
import { Server } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents } from "@arenaz/types";

// Serve static client build if it exists (for production/ngrok)
const CLIENT_DIST = join(import.meta.dirname, "../../client/dist");
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html", ".js": "application/javascript", ".css": "text/css",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".json": "application/json", ".woff2": "font/woff2",
};
import {
  createRoom,
  joinRoom,
  leaveRoom,
  selectCharacter,
  selectGamemode,
  assignTeam,
  startGame,
  getRoomForPlayer,
  resetRoom,
} from "./rooms/rooms.js";
import {
  createGame,
  handleInput,
  handleAugmentSelection,
  handleReroll,
  removePlayerFromGame,
  isGameActive,
} from "./game/game.js";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const hasClientBuild = existsSync(CLIENT_DIST);

const httpServer = createServer((req, res) => {
  if (!hasClientBuild) { res.writeHead(404); res.end("No client build"); return; }

  let filePath = join(CLIENT_DIST, req.url === "/" ? "index.html" : req.url!);
  // SPA fallback — serve index.html for non-file paths
  if (!existsSync(filePath)) filePath = join(CLIENT_DIST, "index.html");

  try {
    const data = readFileSync(filePath);
    const ext = extname(filePath);
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404); res.end("Not found");
  }
});

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  console.log(`[connect] ${socket.id}`);

  socket.on("createRoom", (name) => {
    const room = createRoom(socket.id, name);
    socket.join(room.code);
    socket.emit("roomState", room);
    console.log(`[room] ${name} (${socket.id}) created room ${room.code}`);
  });

  socket.on("joinRoom", (code, name) => {
    const result = joinRoom(socket.id, code, name);
    if ("error" in result) { socket.emit("error", result.error); return; }
    socket.join(result.room.code);
    io.to(result.room.code).emit("roomState", result.room);
    console.log(`[room] ${name} (${socket.id}) joined room ${code}`);
  });

  socket.on("selectCharacter", (character) => {
    const room = selectCharacter(socket.id, character);
    if (!room) return;
    io.to(room.code).emit("roomState", room);
  });

  socket.on("selectGamemode", (mode) => {
    const result = selectGamemode(socket.id, mode);
    if (!result) return;
    if ("error" in result) { socket.emit("error", result.error); return; }
    io.to(result.code).emit("roomState", result);
  });

  socket.on("assignTeam", (playerId, team) => {
    const result = assignTeam(socket.id, playerId, team);
    if (!result) return;
    if ("error" in result) { socket.emit("error", result.error); return; }
    io.to(result.code).emit("roomState", result);
  });

  socket.on("startGame", () => {
    const result = startGame(socket.id);
    if ("error" in result) { socket.emit("error", result.error); return; }
    io.to(result.code).emit("roomState", result);

    createGame(
      result,
      (roomCode, state) => { io.to(roomCode).emit("gameState", state); },
      (_roomCode, playerId, state) => { io.to(playerId).emit("draftState", state); },
      (roomCode, state) => { io.to(roomCode).emit("roundResult", state); },
      (roomCode, data) => {
        io.to(roomCode).emit("gameOver", data);
        const room = resetRoom(roomCode);
        if (room) io.to(roomCode).emit("roomState", room);
        console.log(`[room] match over in room ${roomCode}`);
      }
    );
    console.log(`[room] game started in room ${result.code}`);
  });

  socket.on("input", (input) => {
    const room = getRoomForPlayer(socket.id);
    if (!room) return;
    handleInput(room.code, socket.id, input);
  });

  socket.on("selectAugment", (augmentId) => {
    const room = getRoomForPlayer(socket.id);
    if (!room) return;
    handleAugmentSelection(room.code, socket.id, augmentId);
  });

  socket.on("rerollDraft", (cardIndex) => {
    const room = getRoomForPlayer(socket.id);
    if (!room) return;
    handleReroll(room.code, socket.id, cardIndex);
  });

  socket.on("disconnect", () => {
    console.log(`[disconnect] ${socket.id}`);
    const room = getRoomForPlayer(socket.id);
    if (room && isGameActive(room.code)) {
      removePlayerFromGame(room.code, socket.id);
    }
    const result = leaveRoom(socket.id);
    if (result) {
      io.to(result.room.code).emit("roomState", result.room);
      io.to(result.room.code).emit("playerLeft", socket.id);
    }
  });
});

httpServer.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n[error] Port ${PORT} is already in use.`);
    console.error(`  Run this to free it:  lsof -ti:${PORT} | xargs kill -9\n`);
    process.exit(1);
  }
  throw err;
});

httpServer.listen(PORT, () => {
  console.log(`Arenaz server listening on http://localhost:${PORT}`);
});
