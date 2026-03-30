import { io, Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "@arenaz/types";

const SERVER_URL = "http://localhost:3001";

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
