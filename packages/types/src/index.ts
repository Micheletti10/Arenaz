// ── Game Enums ──

export type GameMode = "FFA" | "Duo";

// ── Augment System ──

export type AugmentTier = "Silver" | "Gold" | "Prismatic";

export type AugmentId =
  | "AttackBoost" | "SpeedBoost" | "HpBoost" | "AttackSpeedBoost"
  | "CritChance" | "ArmorBoost" | "RangeBoostSmall"
  | "LifestealSmall" | "BulletSpeedSmall"
  | "Multishot" | "Ricochet" | "PiercingShot" | "BouncyWall"
  | "Freeze" | "Blaze" | "RangeBoostMedium"
  | "LifestealMedium" | "BulletSpeedMedium"
  | "FrontArrow" | "SideArrows" | "DeathNova" | "ShieldGuard" | "Giant" | "Sniper"
  | "LifestealLarge" | "BulletSpeedLarge";

export interface AugmentDefinition {
  id: AugmentId;
  name: string;
  tier: AugmentTier;
  description: string;
  stackable: boolean;
}

export interface AugmentCard {
  id: AugmentId;
  name: string;
  tier: AugmentTier;
  description: string;
}

// ── Round / Phase System ──

export type MatchPhase = "draft" | "combat" | "roundResult" | "matchOver";

export interface RoundMatchup {
  team1: number;
  team2: number;
}

export interface DraftState {
  phase: "draft";
  roundNumber: number;
  tier: AugmentTier;
  cards: AugmentCard[];
  cardRerolls: number[];
  timerMs: number;
  selections: Record<string, AugmentId | null>;
}

export interface RoundResultState {
  phase: "roundResult";
  roundNumber: number;
  timerMs: number;
  roundKills: Record<string, number>;
  totalKills: Record<string, number>;
  totalDeaths: Record<string, number>;
  matchups: RoundMatchup[];
  teamHealthChanges: Record<number, number>; // team -> HP lost this round
  teamHealths: Record<number, number>;       // team -> current HP
  eliminations: number[];                    // team numbers eliminated this round
}

// ── Geometry ──

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ── Team ──

export interface TeamState {
  teamNumber: number;
  health: number;
  eliminated: boolean;
  eliminationOrder: number; // 0 = not eliminated
  playerIds: string[];
  color: number;     // hex color value
  colorName: string;
}

// ── Game Objects ──

export interface PlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  team: number; // 1-6 for FFA, 1-3 for Duo
  level: number;
  aimAngle: number;
  alive: boolean;
  kills: number;
  deaths: number;
  slowed: boolean;
  damageDealt: number;
  damageFlashMs: number;
  onBye: boolean; // true if team has a bye this round (invulnerable)
  // Augment state
  augments: AugmentId[];
  critChance: number;
  armor: number;
  range: number;
  burning: boolean;
  frozen: boolean;
  shieldGuardReady: boolean;
  playerRadius: number;
  stats: {
    health: number;
    attackDamage: number;
    attackSpeed: number;
    armor: number;
    movementSpeed: number;
    range: number;
  };
}

export interface BulletState {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  bouncesRemaining: number;
  piercing: boolean;
}

export interface KillFeedEntry {
  killerId: string;
  victimId: string;
  timestamp: number;
}

export interface GameOverPlayerStats {
  id: string;
  name: string;
  team: number;
  placement: number;
  kills: number;
  deaths: number;
  damageDealt: number;
  augments: AugmentId[];
}

export interface GameOverData {
  players: GameOverPlayerStats[];
  gameMode: GameMode;
  matchDurationMs: number;
  teamPlacements: { teamNumber: number; placement: number; health: number }[];
}

export interface GameState {
  phase: "combat";
  roundNumber: number;
  players: PlayerState[];
  bullets: BulletState[];
  teams: TeamState[];
  matchups: RoundMatchup[];
  killFeed: KillFeedEntry[];
  walls: Rect[];
  mapWidth: number;
  mapHeight: number;
  timeRemainingMs: number;
  roomCode: string;
  gameMode: GameMode;
  currentLevel: number;
}

// ── Lobby ──

export interface LobbyPlayer {
  id: string;
  name: string;
  team: number; // auto-assigned at game start
  isHost: boolean;
}

export interface RoomState {
  code: string;
  hostId: string;
  gameMode: GameMode;
  players: LobbyPlayer[];
  started: boolean;
}

// ── Socket Events ──

export interface ServerToClientEvents {
  roomState: (state: RoomState) => void;
  gameState: (state: GameState) => void;
  draftState: (state: DraftState) => void;
  roundResult: (state: RoundResultState) => void;
  gameOver: (data: GameOverData) => void;
  playerJoined: (player: LobbyPlayer) => void;
  playerLeft: (playerId: string) => void;
  error: (message: string) => void;
}

export interface ClientToServerEvents {
  createRoom: (name: string) => void;
  joinRoom: (code: string, name: string) => void;
  selectGamemode: (mode: GameMode) => void;
  startGame: () => void;
  ready: () => void;
  input: (input: InputPayload) => void;
  selectAugment: (augmentId: AugmentId) => void;
  rerollDraft: (cardIndex: number) => void;
}

export interface InputPayload {
  dx: number;
  dy: number;
  aimAngle: number;
  shoot: boolean;
}
