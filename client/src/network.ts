import { io, Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "@arenaz/types";

// In production (served from server), connect to same origin.
// In dev (Vite on 5173), connect to localhost:3001.
const isDev = window.location.port === "5173";
const SERVER_URL = isDev ? "http://localhost:3001" : window.location.origin;

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  SERVER_URL,
  { autoConnect: false }
);

socket.on("connect", () => {
  console.log("[socket] connected:", socket.id);
});

socket.on("error", (message) => {
  console.error("[socket] error:", message);
});

socket.on("disconnect", () => {
  console.log("[socket] disconnected from server");
});
