// ── Game Enums ──

export type GameMode = "Deathmatch" | "TeamDeathmatch";

export type CharacterType = "Bruiser" | "Phantom" | "Warden";

export type Team = 0 | 1 | 2; // 0 = unassigned, 1 = red, 2 = blue

// ── Augment System ──

export type AugmentTier = "Silver" | "Gold" | "Prismatic";

export type AugmentId =
  // Silver (stackable stat boosts)
  | "AttackBoost"
  | "SpeedBoost"
  | "HpBoost"
  | "AttackSpeedBoost"
  | "CritChance"
  | "ArmorBoost"
  | "RangeBoostSmall"
  // Gold (mechanical changes, non-stackable)
  | "Multishot"
  | "Ricochet"
  | "PiercingShot"
  | "BouncyWall"
  | "Freeze"
  | "Blaze"
  | "RangeBoostMedium"
  // Prismatic (game-changing, non-stackable)
  | "FrontArrow"
  | "SideArrows"
  | "DeathNova"
  | "ShieldGuard"
  | "Giant"
  | "Sniper";

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

export interface DraftState {
  phase: "draft";
  roundNumber: number;
  tier: AugmentTier;
  cards: AugmentCard[]; // 3 cards
  cardRerolls: number[]; // rerolls remaining per card (e.g. [2, 2, 2])
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
}

// ── Geometry ──

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ── Game Objects ──

export interface PlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  character: CharacterType;
  team: Team;
  aimAngle: number;
  alive: boolean;
  kills: number;
  deaths: number;
  abilityCooldownRemaining: number;
  abilityActive: boolean;
  blinkBonusReady: boolean;
  slowed: boolean;
  damageDealt: number;
  damageFlashMs: number;
  // Augment state
  augments: AugmentId[];
  critChance: number;
  armor: number;
  range: number; // bullet max travel distance in px (0 = infinite)
  burning: boolean;
  frozen: boolean;
  shieldGuardReady: boolean;
  playerRadius: number;
  // Computed stats for HUD display
  stats: {
    health: number;
    attackDamage: number;
    attackSpeed: number; // shots per second
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

export interface PulseGrenadeState {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  radius: number;
  remainingMs: number;
}

export interface KillFeedEntry {
  killerId: string;
  victimId: string;
  timestamp: number;
}

export interface GameOverPlayerStats {
  id: string;
  name: string;
  character: CharacterType;
  team: Team;
  kills: number;
  deaths: number;
  damageDealt: number;
  augments: AugmentId[];
}

export interface GameOverData {
  players: GameOverPlayerStats[];
  gameMode: GameMode;
  matchDurationMs: number;
}

export interface GameState {
  phase: "combat";
  roundNumber: number;
  players: PlayerState[];
  bullets: BulletState[];
  pulseGrenades: PulseGrenadeState[];
  killFeed: KillFeedEntry[];
  walls: Rect[];
  mapWidth: number;
  mapHeight: number;
  timeRemainingMs: number;
  roomCode: string;
  gameMode: GameMode;
}

// ── Lobby ──

export interface LobbyPlayer {
  id: string;
  name: string;
  character: CharacterType | null;
  team: Team;
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
  selectCharacter: (character: CharacterType) => void;
  selectGamemode: (mode: GameMode) => void;
  assignTeam: (playerId: string, team: Team) => void;
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
  ability: boolean;
}
