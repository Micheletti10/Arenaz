import type {
  CharacterType,
  GameMode,
  GameState,
  PlayerState,
  BulletState,
  PulseGrenadeState,
  KillFeedEntry,
  InputPayload,
  Rect,
  Team,
  RoomState,
  GameOverData,
  MatchPhase,
  AugmentId,
  AugmentTier,
  AugmentCard,
  AugmentDefinition,
  DraftState,
  RoundResultState,
} from "@arenaz/types";
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  WALL_THICKNESS,
  TICK_MS,
  RESPAWN_DELAY_MS,
  PLAYER_RADIUS,
  BULLET_SPEED,
  BULLET_RADIUS,
  SHOOT_COOLDOWN_MS,
  BRUISER_HP,
  BRUISER_SPEED,
  BRUISER_DAMAGE,
  BRUISER_PASSIVE_THRESHOLD,
  BRUISER_PASSIVE_REDUCTION,
  BRUISER_BASH_COOLDOWN_MS,
  BRUISER_BASH_RANGE,
  BRUISER_BASH_KNOCKBACK,
  PHANTOM_HP,
  PHANTOM_SPEED,
  PHANTOM_DAMAGE,
  PHANTOM_BLINK_BONUS,
  PHANTOM_BLINK_COOLDOWN_MS,
  PHANTOM_BLINK_DISTANCE,
  WARDEN_HP,
  WARDEN_SPEED,
  WARDEN_DAMAGE,
  WARDEN_HEAL_RATE,
  WARDEN_HEAL_DELAY_MS,
  WARDEN_GRENADE_COOLDOWN_MS,
  WARDEN_GRENADE_RADIUS,
  WARDEN_GRENADE_DURATION_MS,
  WARDEN_GRENADE_SLOW,
  WARDEN_GRENADE_RANGE,
  KILL_FEED_MAX,
  KILL_FEED_DURATION_MS,
  TOTAL_ROUNDS,
  AUG_ATTACK_BOOST,
  AUG_SPEED_BOOST,
  AUG_SPEED_CAP,
  AUG_HP_BOOST,
  AUG_ATTACK_SPEED_BOOST,
  AUG_ATTACK_SPEED_FLOOR_MS,
  AUG_CRIT_CHANCE,
  AUG_CRIT_MULTIPLIER,
  AUG_CRIT_CAP,
  AUG_MULTISHOT_SPREAD,
  AUG_MULTISHOT_DAMAGE_PENALTY,
  AUG_RICOCHET_DAMAGE_PENALTY,
  AUG_RICOCHET_RANGE,
  AUG_PIERCING_DAMAGE_PENALTY,
  AUG_BOUNCY_WALL_BOUNCES,
  AUG_BOUNCY_WALL_DAMAGE_PENALTY,
  AUG_FREEZE_SLOW,
  AUG_FREEZE_DURATION_MS,
  AUG_BLAZE_DPS_PERCENT,
  AUG_BLAZE_DURATION_MS,
  AUG_FRONT_ARROW_DAMAGE_PENALTY,
  AUG_SIDE_ARROWS_ANGLE,
  AUG_SIDE_ARROWS_DAMAGE_PENALTY,
  AUG_DEATH_NOVA_PROJECTILES,
  AUG_DEATH_NOVA_DAMAGE_PERCENT,
  AUG_SHIELD_GUARD_COOLDOWN_MS,
  AUG_GIANT_DAMAGE_BOOST,
  AUG_GIANT_HP_BOOST,
  AUG_GIANT_RADIUS_MULTIPLIER,
  AUG_ARMOR_BOOST,
  AUG_RANGE_BOOST_SMALL,
  AUG_RANGE_BOOST_MEDIUM,
  AUG_SNIPER_RANGE,
  AUG_MULTISHOT_SPREAD_BASE,
  BASE_BULLET_RANGE,
  ARMOR_FORMULA_CONSTANT,
  DRAFT_REROLLS_PER_CARD,
  COMBAT_DURATION_S,
  DRAFT_DURATION_MS,
  ROUND_RESULT_DURATION_MS,
  DRAFT_CARDS_OFFERED,
} from "@arenaz/types/src/constants.js";

// ── Map walls ──

const walls: Rect[] = [
  { x: 0, y: 0, w: MAP_WIDTH, h: WALL_THICKNESS },
  { x: 0, y: MAP_HEIGHT - WALL_THICKNESS, w: MAP_WIDTH, h: WALL_THICKNESS },
  { x: 0, y: 0, w: WALL_THICKNESS, h: MAP_HEIGHT },
  { x: MAP_WIDTH - WALL_THICKNESS, y: 0, w: WALL_THICKNESS, h: MAP_HEIGHT },
  { x: 300, y: 250, w: 200, h: 30 },
  { x: 1100, y: 250, w: 200, h: 30 },
  { x: 300, y: 920, w: 200, h: 30 },
  { x: 1100, y: 920, w: 200, h: 30 },
  { x: 750, y: 500, w: 100, h: 30 },
  { x: 750, y: 670, w: 100, h: 30 },
  { x: 700, y: 550, w: 30, h: 100 },
  { x: 870, y: 550, w: 30, h: 100 },
  { x: 200, y: 550, w: 40, h: 100 },
  { x: 1360, y: 550, w: 40, h: 100 },
  { x: 100, y: 100, w: 60, h: 60 },
  { x: MAP_WIDTH - 160, y: 100, w: 60, h: 60 },
  { x: 100, y: MAP_HEIGHT - 160, w: 60, h: 60 },
  { x: MAP_WIDTH - 160, y: MAP_HEIGHT - 160, w: 60, h: 60 },
];

const INPUT_STALE_MS = 150;

// ── Augment definitions ──

// Augment tier is random each round (weighted: Silver 50%, Gold 35%, Prismatic 15%)
function randomTier(): AugmentTier {
  const roll = Math.random();
  if (roll < 0.50) return "Silver";
  if (roll < 0.85) return "Gold";
  return "Prismatic";
}

const ALL_AUGMENTS: AugmentDefinition[] = [
  // Silver (stackable)
  { id: "AttackBoost", name: "Attack Boost", tier: "Silver", description: "+15% damage", stackable: true },
  { id: "SpeedBoost", name: "Speed Boost", tier: "Silver", description: "+15% movement speed", stackable: true },
  { id: "HpBoost", name: "HP Boost", tier: "Silver", description: "+20% max HP (heals to new max)", stackable: true },
  { id: "AttackSpeedBoost", name: "Attack Speed", tier: "Silver", description: "+15% fire rate", stackable: true },
  { id: "CritChance", name: "Critical Hit", tier: "Silver", description: "+10% chance for 1.5x damage", stackable: true },
  { id: "ArmorBoost", name: "Armor", tier: "Silver", description: "+15 armor (reduces incoming damage)", stackable: true },
  { id: "RangeBoostSmall", name: "Range+", tier: "Silver", description: "+150 bullet range", stackable: true },
  // Gold (non-stackable)
  { id: "Multishot", name: "Multishot", tier: "Gold", description: "+1 extra bullet per shot (-15% damage each)", stackable: true },
  { id: "RangeBoostMedium", name: "Extended Range", tier: "Gold", description: "+400 bullet range", stackable: false },
  { id: "Ricochet", name: "Ricochet", tier: "Gold", description: "Bullets bounce to 1 nearby enemy (-30% damage)", stackable: false },
  { id: "PiercingShot", name: "Piercing Shot", tier: "Gold", description: "Bullets pass through first enemy (-33% damage)", stackable: false },
  { id: "BouncyWall", name: "Bouncy Wall", tier: "Gold", description: "Bullets bounce off walls 2x (-50% after bounce)", stackable: false },
  { id: "Freeze", name: "Freeze", tier: "Gold", description: "Hits slow enemy by 30% for 1.5s", stackable: false },
  { id: "Blaze", name: "Blaze", tier: "Gold", description: "Hits burn for 15% base damage/s for 2s", stackable: false },
  // Prismatic (non-stackable)
  { id: "FrontArrow", name: "Front Arrow", tier: "Prismatic", description: "+1 extra bullet forward, ALL bullets -25% damage", stackable: false },
  { id: "SideArrows", name: "Side Arrows", tier: "Prismatic", description: "+2 bullets at 60° angles (-40% damage)", stackable: false },
  { id: "DeathNova", name: "Death Nova", tier: "Prismatic", description: "Killed enemies explode into 6 projectiles", stackable: false },
  { id: "ShieldGuard", name: "Shield Guard", tier: "Prismatic", description: "Orbiting shield blocks 1 bullet every 8s", stackable: false },
  { id: "Giant", name: "Giant", tier: "Prismatic", description: "+40% damage, +5% HP, 35% larger hitbox", stackable: false },
  { id: "Sniper", name: "Sniper", tier: "Prismatic", description: "Infinite bullet range", stackable: false },
];

// ── Internal types ──

interface InternalPlayer {
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
  baseSpeed: number;
  baseDamage: number;
  input: InputPayload;
  inputReceivedAt: number;
  shootCooldownRemaining: number;
  abilityCooldownRemaining: number;
  abilityActive: boolean;
  knockbackVx: number;
  knockbackVy: number;
  blinkBonusReady: boolean;
  lastDamageTime: number;
  respawnTimer: number;
  slowMultiplier: number;
  damageDealt: number;
  damageFlashMs: number;
  // Augments
  augments: AugmentId[];
  // Computed from augments at round start
  effectiveSpeed: number;
  effectiveDamage: number;
  effectiveMaxHp: number;
  effectiveShootCooldown: number;
  critChance: number;
  armor: number;
  effectiveRange: number; // 0 = infinite
  playerRadius: number;
  // Augment runtime state
  shieldGuardActive: boolean;
  shieldGuardCooldownMs: number;
  freezeRemainingMs: number;
  burnRemainingMs: number;
  burnDamagePerTick: number;
}

interface InternalBullet {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  bouncesRemaining: number;
  piercing: boolean;
  distanceTraveled: number;
  maxRange: number; // 0 = infinite
}

interface InternalGrenade {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  radius: number;
  remainingMs: number;
}

interface ActiveGame {
  roomCode: string;
  gameMode: GameMode;
  players: Map<string, InternalPlayer>;
  bullets: InternalBullet[];
  grenades: InternalGrenade[];
  killFeed: KillFeedEntry[];
  nextBulletId: number;
  nextGrenadeId: number;
  intervalId: ReturnType<typeof setInterval>;
  // Round system
  phase: MatchPhase;
  roundNumber: number;
  roundTimeRemainingMs: number;
  draftTimeRemainingMs: number;
  resultTimeRemainingMs: number;
  matchStartTime: number;
  // Draft — per-player cards and rerolls (each player sees different cards)
  playerDraftCards: Map<string, AugmentCard[]>; // playerId -> their 3 cards
  playerCardRerolls: Map<string, number[]>; // playerId -> rerolls per card
  draftSelections: Map<string, AugmentId | null>;
  draftTier: AugmentTier;
  // Per-round kill tracking
  roundKills: Map<string, number>;
  totalKills: Map<string, number>;
  totalDeaths: Map<string, number>;
  // Broadcast callbacks
  broadcastGameState: (roomCode: string, state: GameState) => void;
  broadcastDraftStateToPlayer: (roomCode: string, playerId: string, state: DraftState) => void;
  broadcastRoundResult: (roomCode: string, state: RoundResultState) => void;
  broadcastGameOver: (roomCode: string, data: GameOverData) => void;
}

const activeGames: Map<string, ActiveGame> = new Map();
let bulletIdCounter = 0;
let grenadeIdCounter = 0;

// ── Character stats ──

function getCharacterStats(character: CharacterType): { hp: number; speed: number; damage: number } {
  switch (character) {
    case "Bruiser": return { hp: BRUISER_HP, speed: BRUISER_SPEED, damage: BRUISER_DAMAGE };
    case "Phantom": return { hp: PHANTOM_HP, speed: PHANTOM_SPEED, damage: PHANTOM_DAMAGE };
    case "Warden": return { hp: WARDEN_HP, speed: WARDEN_SPEED, damage: WARDEN_DAMAGE };
  }
}

// ── Spawns ──

// Spawn points — verified to not collide with any wall at PLAYER_RADIUS
const SPAWN_POINTS: { x: number; y: number }[] = [
  { x: 250, y: 400 }, { x: 1350, y: 400 },
  { x: 250, y: 700 }, { x: 1350, y: 700 },
  { x: 800, y: 350 }, { x: 800, y: 850 },
];

function getInitialSpawns(playerIds: string[], teams: Map<string, Team>, mode: GameMode): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>();
  if (mode === "TeamDeathmatch") {
    const ri = [0, 2, 4]; const bi = [1, 3, 5];
    let rc = 0; let bc = 0;
    for (const id of playerIds) {
      const team = teams.get(id);
      if (team === 1) { result.set(id, { ...SPAWN_POINTS[ri[rc++ % ri.length]] }); }
      else { result.set(id, { ...SPAWN_POINTS[bi[bc++ % bi.length]] }); }
    }
  } else {
    playerIds.forEach((id, i) => result.set(id, { ...SPAWN_POINTS[i % SPAWN_POINTS.length] }));
  }
  return result;
}

function getRespawnPosition(player: InternalPlayer, game: ActiveGame): { x: number; y: number } {
  const indices = game.gameMode === "TeamDeathmatch" && player.team === 1
    ? [0, 2, 4] : game.gameMode === "TeamDeathmatch" && player.team === 2
      ? [1, 3, 5] : [0, 1, 2, 3, 4, 5];
  const spawns = indices.map((i) => SPAWN_POINTS[i]);
  let bestSpawn = spawns[0]; let bestMinDist = 0;
  for (const spawn of spawns) {
    let minDist = Infinity;
    for (const other of game.players.values()) {
      if (other.id === player.id || !other.alive) continue;
      const d = (other.x - spawn.x) ** 2 + (other.y - spawn.y) ** 2;
      minDist = Math.min(minDist, d);
    }
    if (minDist > bestMinDist) { bestMinDist = minDist; bestSpawn = spawn; }
  }
  return bestSpawn;
}

// ── Create game ──

export function createGame(
  room: RoomState,
  broadcastGameState: (roomCode: string, state: GameState) => void,
  broadcastDraftStateToPlayer: (roomCode: string, playerId: string, state: DraftState) => void,
  broadcastRoundResult: (roomCode: string, state: RoundResultState) => void,
  broadcastGameOver: (roomCode: string, data: GameOverData) => void,
): void {
  const players = new Map<string, InternalPlayer>();
  const teamMap = new Map<string, Team>();
  for (const lp of room.players) teamMap.set(lp.id, lp.team);
  const spawns = getInitialSpawns(room.players.map((p) => p.id), teamMap, room.gameMode);

  const totalKills = new Map<string, number>();
  const totalDeaths = new Map<string, number>();
  const roundKills = new Map<string, number>();

  room.players.forEach((lp) => {
    const stats = getCharacterStats(lp.character!);
    const spawn = spawns.get(lp.id) ?? { x: 400, y: 400 };
    players.set(lp.id, createInternalPlayer(lp.id, lp.name, spawn.x, spawn.y, lp.character!, lp.team, stats));
    totalKills.set(lp.id, 0);
    totalDeaths.set(lp.id, 0);
    roundKills.set(lp.id, 0);
  });

  const game: ActiveGame = {
    roomCode: room.code,
    gameMode: room.gameMode,
    players,
    bullets: [],
    grenades: [],
    killFeed: [],
    nextBulletId: 0,
    nextGrenadeId: 0,
    intervalId: null!,
    phase: "draft",
    roundNumber: 1,
    roundTimeRemainingMs: COMBAT_DURATION_S * 1000,
    draftTimeRemainingMs: DRAFT_DURATION_MS,
    resultTimeRemainingMs: ROUND_RESULT_DURATION_MS,
    matchStartTime: Date.now(),
    playerDraftCards: new Map(),
    playerCardRerolls: new Map(),
    draftSelections: new Map(),
    draftTier: "Silver",
    roundKills,
    totalKills,
    totalDeaths,
    broadcastGameState,
    broadcastDraftStateToPlayer,
    broadcastRoundResult,
    broadcastGameOver,
  };

  // Start first draft phase
  startDraftPhase(game);

  game.intervalId = setInterval(() => tick(game), TICK_MS);
  activeGames.set(room.code, game);
  console.log(`[game] started in ${room.code}, round 1 draft`);
}

function createInternalPlayer(
  id: string, name: string, x: number, y: number,
  character: CharacterType, team: Team,
  stats: { hp: number; speed: number; damage: number }
): InternalPlayer {
  return {
    id, name, x, y,
    hp: stats.hp, maxHp: stats.hp,
    character, team,
    aimAngle: 0, alive: true,
    kills: 0, deaths: 0, damageDealt: 0,
    baseSpeed: stats.speed, baseDamage: stats.damage,
    input: { dx: 0, dy: 0, aimAngle: 0, shoot: false, ability: false },
    inputReceivedAt: Date.now(),
    shootCooldownRemaining: 0, abilityCooldownRemaining: 0,
    abilityActive: false,
    knockbackVx: 0, knockbackVy: 0,
    blinkBonusReady: false, lastDamageTime: 0,
    respawnTimer: 0, slowMultiplier: 1,
    damageFlashMs: 0,
    augments: [],
    effectiveSpeed: stats.speed,
    effectiveDamage: stats.damage,
    effectiveMaxHp: stats.hp,
    effectiveShootCooldown: SHOOT_COOLDOWN_MS,
    critChance: 0,
    armor: 0,
    effectiveRange: BASE_BULLET_RANGE,
    playerRadius: PLAYER_RADIUS,
    shieldGuardActive: false,
    shieldGuardCooldownMs: 0,
    freezeRemainingMs: 0,
    burnRemainingMs: 0,
    burnDamagePerTick: 0,
  };
}

// ── Public API ──

export function handleInput(roomCode: string, playerId: string, input: InputPayload): void {
  const game = activeGames.get(roomCode);
  if (!game || game.phase !== "combat") return;
  const player = game.players.get(playerId);
  if (!player) return;
  player.input = input;
  player.inputReceivedAt = Date.now();
}

export function handleAugmentSelection(roomCode: string, playerId: string, augmentId: AugmentId): void {
  const game = activeGames.get(roomCode);
  if (!game || game.phase !== "draft") return;
  if (!game.draftSelections.has(playerId)) return;
  if (game.draftSelections.get(playerId) !== null) return;
  // Validate the augment is in THIS player's offered cards
  const playerCards = game.playerDraftCards.get(playerId);
  if (!playerCards || !playerCards.some((c) => c.id === augmentId)) return;

  game.draftSelections.set(playerId, augmentId);
  const player = game.players.get(playerId);
  if (player) {
    player.augments.push(augmentId);
    console.log(`[draft] ${playerId.slice(0, 6)} picked ${augmentId}`);
  }

  checkDraftComplete(game);
}

export function handleReroll(roomCode: string, playerId: string, cardIndex: number): void {
  const game = activeGames.get(roomCode);
  if (!game || game.phase !== "draft") return;
  if (game.draftSelections.get(playerId) !== null) return;
  const playerCards = game.playerDraftCards.get(playerId);
  const playerRerolls = game.playerCardRerolls.get(playerId);
  if (!playerCards || !playerRerolls) return;
  if (cardIndex < 0 || cardIndex >= playerCards.length) return;
  if (playerRerolls[cardIndex] <= 0) return;

  playerRerolls[cardIndex]--;
  // Replace this one card with a new random augment of same tier
  const currentIds = new Set(playerCards.map((c: AugmentCard) => c.id));
  const pool = ALL_AUGMENTS.filter((a) => a.tier === game.draftTier && !currentIds.has(a.id));
  if (pool.length > 0) {
    const replacement = pool[Math.floor(Math.random() * pool.length)];
    playerCards[cardIndex] = { id: replacement.id, name: replacement.name, tier: replacement.tier, description: replacement.description };
  }

  broadcastDraft(game);
  console.log(`[draft] ${playerId.slice(0, 6)} rerolled card ${cardIndex}, ${playerRerolls[cardIndex]} left`);
}

export function removePlayerFromGame(roomCode: string, playerId: string): void {
  const game = activeGames.get(roomCode);
  if (!game) return;
  game.players.delete(playerId);
  game.bullets = game.bullets.filter((b) => b.ownerId !== playerId);
  if (game.players.size === 0) {
    clearInterval(game.intervalId);
    activeGames.delete(roomCode);
  }
}

export function stopGame(roomCode: string): void {
  const game = activeGames.get(roomCode);
  if (!game) return;
  clearInterval(game.intervalId);
  activeGames.delete(roomCode);
}

export function isGameActive(roomCode: string): boolean {
  return activeGames.has(roomCode);
}

// ══════════════════════════════════
// ── Draft Phase ──
// ══════════════════════════════════

function startDraftPhase(game: ActiveGame): void {
  game.phase = "draft";
  game.draftTier = randomTier();
  game.draftTimeRemainingMs = DRAFT_DURATION_MS;
  game.draftSelections = new Map();
  game.playerDraftCards = new Map();
  game.playerCardRerolls = new Map();

  // Generate unique random cards for each player (same tier, different cards)
  for (const id of game.players.keys()) {
    game.draftSelections.set(id, null);
    const pool = ALL_AUGMENTS.filter((a) => a.tier === game.draftTier);
    const shuffled = shuffleArray([...pool]);
    game.playerDraftCards.set(id, shuffled.slice(0, DRAFT_CARDS_OFFERED).map((a) => ({
      id: a.id, name: a.name, tier: a.tier, description: a.description,
    })));
    game.playerCardRerolls.set(id, Array(DRAFT_CARDS_OFFERED).fill(DRAFT_REROLLS_PER_CARD));
  }

  broadcastDraft(game);
}

function checkDraftComplete(game: ActiveGame): void {
  const allPicked = Array.from(game.draftSelections.values()).every((v) => v !== null);
  if (allPicked) {
    startCombatPhase(game);
  }
}

function tickDraft(game: ActiveGame): void {
  game.draftTimeRemainingMs -= TICK_MS;

  // Broadcast draft state every 10 ticks (~6/s) for timer updates
  if (Math.floor(game.draftTimeRemainingMs / TICK_MS) % 10 === 0) {
    broadcastDraft(game);
  }

  if (game.draftTimeRemainingMs <= 0) {
    // Auto-pick a random card for players who didn't select
    for (const [playerId, selection] of game.draftSelections.entries()) {
      if (selection === null) {
        const playerCards = game.playerDraftCards.get(playerId);
        if (playerCards && playerCards.length > 0) {
          const autoCard = playerCards[Math.floor(Math.random() * playerCards.length)];
          game.draftSelections.set(playerId, autoCard.id);
          const player = game.players.get(playerId);
          if (player) player.augments.push(autoCard.id);
          console.log(`[draft] auto-picked ${autoCard.id} for ${playerId.slice(0, 6)}`);
        }
      }
    }
    startCombatPhase(game);
  }
}

function broadcastDraft(game: ActiveGame): void {
  const selections: Record<string, AugmentId | null> = {};
  for (const [id, sel] of game.draftSelections.entries()) {
    selections[id] = sel;
  }

  // Send each player their own unique cards
  for (const playerId of game.players.keys()) {
    const cards = game.playerDraftCards.get(playerId) ?? [];
    const rerolls = game.playerCardRerolls.get(playerId) ?? [];
    const state: DraftState = {
      phase: "draft",
      roundNumber: game.roundNumber,
      tier: game.draftTier,
      cards,
      cardRerolls: rerolls,
      timerMs: game.draftTimeRemainingMs,
      selections,
    };
    // Use per-player broadcast
    game.broadcastDraftStateToPlayer(game.roomCode, playerId, state);
  }
}

// ── Augment helpers ──

function hasAugment(player: InternalPlayer, id: AugmentId): boolean {
  return player.augments.includes(id);
}

function countAugment(player: InternalPlayer, id: AugmentId): number {
  return player.augments.filter((a) => a === id).length;
}

function recalculatePlayerStats(player: InternalPlayer): void {
  const base = getCharacterStats(player.character);

  let speedMul = 1;
  let damageMul = 1;
  let hpMul = 1;
  let attackSpeedMul = 1;
  let critChance = 0;
  let radiusMul = 1;
  let armor = 0;
  let range = BASE_BULLET_RANGE;

  for (const aug of player.augments) {
    switch (aug) {
      case "AttackBoost": damageMul += AUG_ATTACK_BOOST; break;
      case "SpeedBoost": speedMul += AUG_SPEED_BOOST; break;
      case "HpBoost": hpMul += AUG_HP_BOOST; break;
      case "AttackSpeedBoost": attackSpeedMul += AUG_ATTACK_SPEED_BOOST; break;
      case "CritChance": critChance += AUG_CRIT_CHANCE; break;
      case "ArmorBoost": armor += AUG_ARMOR_BOOST; break;
      case "RangeBoostSmall": range += AUG_RANGE_BOOST_SMALL; break;
      case "RangeBoostMedium": range += AUG_RANGE_BOOST_MEDIUM; break;
      case "Sniper": range = AUG_SNIPER_RANGE; break; // 0 = infinite
      case "Giant":
        damageMul += AUG_GIANT_DAMAGE_BOOST;
        hpMul += AUG_GIANT_HP_BOOST;
        radiusMul = AUG_GIANT_RADIUS_MULTIPLIER;
        break;
    }
  }

  if (speedMul > AUG_SPEED_CAP) speedMul = AUG_SPEED_CAP;

  player.effectiveSpeed = base.speed * speedMul;
  player.effectiveDamage = base.damage * damageMul;
  player.effectiveMaxHp = Math.round(base.hp * hpMul);
  player.effectiveShootCooldown = Math.max(AUG_ATTACK_SPEED_FLOOR_MS, SHOOT_COOLDOWN_MS / attackSpeedMul);
  player.critChance = Math.min(critChance, AUG_CRIT_CAP);
  player.playerRadius = Math.round(PLAYER_RADIUS * radiusMul);
  player.armor = armor;
  player.effectiveRange = range;

  player.maxHp = player.effectiveMaxHp;
  player.hp = player.effectiveMaxHp;

  player.shieldGuardActive = hasAugment(player, "ShieldGuard");
  player.shieldGuardCooldownMs = 0;
}

// ══════════════════════════════════
// ── Combat Phase ──
// ══════════════════════════════════

function startCombatPhase(game: ActiveGame): void {
  game.phase = "combat";
  game.roundTimeRemainingMs = COMBAT_DURATION_S * 1000;
  game.bullets = [];
  game.grenades = [];
  game.killFeed = [];

  // Reset round kills
  for (const id of game.players.keys()) {
    game.roundKills.set(id, 0);
  }

  // Reset players for new round
  const teamMap = new Map<string, Team>();
  for (const p of game.players.values()) teamMap.set(p.id, p.team);
  const spawns = getInitialSpawns(Array.from(game.players.keys()), teamMap, game.gameMode);

  for (const player of game.players.values()) {
    const stats = getCharacterStats(player.character);
    const spawn = spawns.get(player.id) ?? { x: 400, y: 400 };
    player.x = spawn.x;
    player.y = spawn.y;
    player.hp = stats.hp;
    player.maxHp = stats.hp;
    player.alive = true;
    player.knockbackVx = 0;
    player.knockbackVy = 0;
    player.blinkBonusReady = false;
    player.slowMultiplier = 1;
    player.damageFlashMs = 0;
    player.shootCooldownRemaining = 0;
    player.abilityCooldownRemaining = 0;
    player.lastDamageTime = 0;
    player.freezeRemainingMs = 0;
    player.burnRemainingMs = 0;
    player.burnDamagePerTick = 0;
    // Recalculate stats from augments
    recalculatePlayerStats(player);
    // Keep kills/deaths/damageDealt accumulating across rounds
  }

  console.log(`[game] round ${game.roundNumber} combat started in ${game.roomCode}`);
}

function tickCombat(game: ActiveGame): void {
  const dt = TICK_MS / 1000;
  const now = Date.now();

  game.roundTimeRemainingMs -= TICK_MS;

  // Expire kill feed
  game.killFeed = game.killFeed.filter((e) => now - e.timestamp < KILL_FEED_DURATION_MS);

  for (const player of game.players.values()) {
    if (!player.alive) {
      player.respawnTimer -= TICK_MS;
      if (player.respawnTimer <= 0) respawnPlayer(player, game);
      continue;
    }

    player.damageFlashMs = Math.max(0, player.damageFlashMs - TICK_MS);
    player.shootCooldownRemaining = Math.max(0, player.shootCooldownRemaining - TICK_MS);
    player.abilityCooldownRemaining = Math.max(0, player.abilityCooldownRemaining - TICK_MS);

    // Grenade slow + Freeze augment slow
    player.slowMultiplier = 1;
    for (const grenade of game.grenades) {
      if (grenade.ownerId === player.id) continue;
      if ((player.x - grenade.x) ** 2 + (player.y - grenade.y) ** 2 <= grenade.radius ** 2) {
        player.slowMultiplier = WARDEN_GRENADE_SLOW;
        break;
      }
    }
    // Freeze effect slow (stacks with grenade — takes strongest slow)
    if (player.freezeRemainingMs > 0) {
      player.freezeRemainingMs -= TICK_MS;
      const freezeSlow = 1 - AUG_FREEZE_SLOW;
      if (freezeSlow < player.slowMultiplier) player.slowMultiplier = freezeSlow;
    }

    // Burn tick damage
    if (player.burnRemainingMs > 0) {
      player.burnRemainingMs -= TICK_MS;
      const burnDmg = player.burnDamagePerTick * dt;
      player.hp -= burnDmg;
      player.lastDamageTime = now;
      if (player.hp <= 0) {
        player.hp = 0;
        player.alive = false;
        player.deaths++;
        player.respawnTimer = RESPAWN_DELAY_MS;
        game.totalDeaths.set(player.id, (game.totalDeaths.get(player.id) ?? 0) + 1);
        // Burn kills don't credit anyone (environmental damage)
      }
    }

    // Shield Guard cooldown
    if (hasAugment(player, "ShieldGuard") && !player.shieldGuardActive) {
      player.shieldGuardCooldownMs -= TICK_MS;
      if (player.shieldGuardCooldownMs <= 0) {
        player.shieldGuardActive = true;
      }
    }

    if (!player.alive) continue;

    // Movement — WASD only, no aimAngle, axis-separated collision
    const input = player.input;
    player.aimAngle = input.aimAngle;

    const inputAge = now - player.inputReceivedAt;
    const inputFresh = inputAge < INPUT_STALE_MS;
    const rawDx = inputFresh ? input.dx : 0;
    const rawDy = inputFresh ? input.dy : 0;
    const inputLen = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
    const ndx = inputLen > 0 ? rawDx / inputLen : 0;
    const ndy = inputLen > 0 ? rawDy / inputLen : 0;

    const speed = player.effectiveSpeed * player.slowMultiplier;
    const moveX = ndx * speed * dt + player.knockbackVx * dt;
    const moveY = ndy * speed * dt + player.knockbackVy * dt;

    player.knockbackVx *= 0.85;
    player.knockbackVy *= 0.85;
    if (Math.abs(player.knockbackVx) < 1) player.knockbackVx = 0;
    if (Math.abs(player.knockbackVy) < 1) player.knockbackVy = 0;

    const pr = player.playerRadius;
    const newX = player.x + moveX;
    if (!circleCollidesWalls(newX, player.y, pr)) player.x = newX;
    const newY = player.y + moveY;
    if (!circleCollidesWalls(player.x, newY, pr)) player.y = newY;

    // Warden passive
    if (player.character === "Warden" && player.hp < player.maxHp) {
      if (now - player.lastDamageTime >= WARDEN_HEAL_DELAY_MS) {
        player.hp = Math.min(player.maxHp, player.hp + WARDEN_HEAL_RATE * dt);
      }
    }

    // ── Shooting with augment modifiers ──
    if (inputFresh && input.shoot && player.shootCooldownRemaining <= 0) {
      let baseDamage = player.effectiveDamage;

      // Phantom passive
      if (player.character === "Phantom" && player.blinkBonusReady) {
        baseDamage *= 1 + PHANTOM_BLINK_BONUS;
        player.blinkBonusReady = false;
      }

      // FrontArrow penalizes ALL bullets
      if (hasAugment(player, "FrontArrow")) {
        baseDamage *= 1 - AUG_FRONT_ARROW_DAMAGE_PENALTY;
      }

      // Determine bullet properties from augments
      const bounces = hasAugment(player, "BouncyWall") ? AUG_BOUNCY_WALL_BOUNCES : 0;
      const isPiercing = hasAugment(player, "PiercingShot");

      // Build list of bullet angles + damage
      const bulletSpecs: { angle: number; damage: number }[] = [];

      // Primary bullet
      bulletSpecs.push({ angle: input.aimAngle, damage: baseDamage });

      // FrontArrow: +1 bullet forward (slightly offset)
      if (hasAugment(player, "FrontArrow")) {
        bulletSpecs.push({ angle: input.aimAngle + 0.05, damage: baseDamage });
      }

      // Multishot: each stack adds +1 bullet in a wider fan
      const msLevel = countAugment(player, "Multishot");
      if (msLevel > 0) {
        const penalty = 1 - AUG_MULTISHOT_DAMAGE_PENALTY * msLevel;
        const totalBullets = 1 + msLevel; // 1 base + 1 per multishot
        const spreadTotal = AUG_MULTISHOT_SPREAD_BASE * msLevel;
        // Rebuild bullet specs as an even fan
        const baseAngle = input.aimAngle;
        const baseDmg = baseDamage * Math.max(0.3, penalty);
        bulletSpecs.length = 0; // clear
        for (let mi = 0; mi < totalBullets; mi++) {
          const offset = (mi - (totalBullets - 1) / 2) * (spreadTotal / Math.max(totalBullets - 1, 1));
          bulletSpecs.push({ angle: baseAngle + offset, damage: baseDmg });
        }
        // Re-add FrontArrow extra if present
        if (hasAugment(player, "FrontArrow")) {
          bulletSpecs.push({ angle: baseAngle + 0.05, damage: baseDmg });
        }
      }

      // SideArrows: +2 bullets at ±60° (reduced damage)
      if (hasAugment(player, "SideArrows")) {
        const sideDmg = baseDamage * (1 - AUG_SIDE_ARROWS_DAMAGE_PENALTY);
        bulletSpecs.push({ angle: input.aimAngle + AUG_SIDE_ARROWS_ANGLE, damage: sideDmg });
        bulletSpecs.push({ angle: input.aimAngle - AUG_SIDE_ARROWS_ANGLE, damage: sideDmg });
      }

      // Spawn all bullets
      for (const spec of bulletSpecs) {
        let dmg = spec.damage;
        if (player.critChance > 0 && Math.random() < player.critChance) {
          dmg *= AUG_CRIT_MULTIPLIER;
        }

        game.bullets.push({
          id: `b${bulletIdCounter++}`,
          ownerId: player.id,
          x: player.x + Math.cos(spec.angle) * (pr + BULLET_RADIUS + 2),
          y: player.y + Math.sin(spec.angle) * (pr + BULLET_RADIUS + 2),
          vx: Math.cos(spec.angle) * BULLET_SPEED,
          vy: Math.sin(spec.angle) * BULLET_SPEED,
          damage: dmg,
          bouncesRemaining: bounces,
          piercing: isPiercing,
          distanceTraveled: 0,
          maxRange: player.effectiveRange,
        });
      }

      player.shootCooldownRemaining = player.effectiveShootCooldown;
    }

    // Ability
    if (inputFresh && input.ability && player.abilityCooldownRemaining <= 0) {
      useAbility(player, game);
    }
  }

  updateBullets(game, dt, now);

  game.grenades = game.grenades.filter((g) => {
    g.remainingMs -= TICK_MS;
    return g.remainingMs > 0;
  });

  // Broadcast combat state
  game.broadcastGameState(game.roomCode, buildGameState(game));

  // Check round end
  if (game.roundTimeRemainingMs <= 0) {
    startRoundResultPhase(game);
  }
}

// ══════════════════════════════════
// ── Round Result Phase ──
// ══════════════════════════════════

function startRoundResultPhase(game: ActiveGame): void {
  game.phase = "roundResult";
  game.resultTimeRemainingMs = ROUND_RESULT_DURATION_MS;

  const roundKills: Record<string, number> = {};
  const totalKills: Record<string, number> = {};
  const totalDeaths: Record<string, number> = {};
  for (const id of game.players.keys()) {
    roundKills[id] = game.roundKills.get(id) ?? 0;
    totalKills[id] = game.totalKills.get(id) ?? 0;
    totalDeaths[id] = game.totalDeaths.get(id) ?? 0;
  }

  const state: RoundResultState = {
    phase: "roundResult",
    roundNumber: game.roundNumber,
    timerMs: game.resultTimeRemainingMs,
    roundKills, totalKills, totalDeaths,
  };
  game.broadcastRoundResult(game.roomCode, state);
  console.log(`[game] round ${game.roundNumber} result in ${game.roomCode}`);
}

function tickRoundResult(game: ActiveGame): void {
  game.resultTimeRemainingMs -= TICK_MS;
  if (game.resultTimeRemainingMs <= 0) {
    if (game.roundNumber >= TOTAL_ROUNDS) {
      endMatch(game);
    } else {
      game.roundNumber++;
      startDraftPhase(game);
    }
  }
}

// ══════════════════════════════════
// ── Match Over ──
// ══════════════════════════════════

function endMatch(game: ActiveGame): void {
  game.phase = "matchOver";
  clearInterval(game.intervalId);

  const data: GameOverData = {
    players: Array.from(game.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      character: p.character,
      team: p.team,
      kills: game.totalKills.get(p.id) ?? 0,
      deaths: game.totalDeaths.get(p.id) ?? 0,
      damageDealt: Math.round(p.damageDealt),
      augments: p.augments,
    })),
    gameMode: game.gameMode,
    matchDurationMs: Date.now() - game.matchStartTime,
  };

  game.broadcastGameOver(game.roomCode, data);
  activeGames.delete(game.roomCode);
  console.log(`[game] match over in ${game.roomCode}`);
}

// ══════════════════════════════════
// ── Main Tick Router ──
// ══════════════════════════════════

function tick(game: ActiveGame): void {
  switch (game.phase) {
    case "draft": tickDraft(game); break;
    case "combat": tickCombat(game); break;
    case "roundResult": tickRoundResult(game); break;
    case "matchOver": break;
  }
}

// ── Abilities ──

function useAbility(player: InternalPlayer, game: ActiveGame): void {
  switch (player.character) {
    case "Bruiser":
      player.abilityActive = true;
      for (const other of game.players.values()) {
        if (other.id === player.id || !other.alive) continue;
        if (isSameTeam(player, other, game.gameMode)) continue;
        const dx = other.x - player.x;
        const dy = other.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= BRUISER_BASH_RANGE && dist > 0) {
          other.knockbackVx = (dx / dist) * BRUISER_BASH_KNOCKBACK;
          other.knockbackVy = (dy / dist) * BRUISER_BASH_KNOCKBACK;
        }
      }
      setTimeout(() => { player.abilityActive = false; }, 200);
      player.abilityCooldownRemaining = BRUISER_BASH_COOLDOWN_MS;
      break;

    case "Phantom": {
      const input = player.input;
      const pr = player.playerRadius;
      const minX = WALL_THICKNESS + pr + 2;
      const maxX = MAP_WIDTH - WALL_THICKNESS - pr - 2;
      const minY = WALL_THICKNESS + pr + 2;
      const maxY = MAP_HEIGHT - WALL_THICKNESS - pr - 2;

      let blinkAngle: number;
      if (input.dx !== 0 || input.dy !== 0) blinkAngle = Math.atan2(input.dy, input.dx);
      else blinkAngle = input.aimAngle;

      // Try full distance, then step back
      for (let frac = 1.0; frac >= 0.1; frac -= 0.1) {
        let tx = player.x + Math.cos(blinkAngle) * PHANTOM_BLINK_DISTANCE * frac;
        let ty = player.y + Math.sin(blinkAngle) * PHANTOM_BLINK_DISTANCE * frac;
        tx = clamp(tx, minX, maxX);
        ty = clamp(ty, minY, maxY);
        if (!circleCollidesWalls(tx, ty, pr)) {
          player.x = tx; player.y = ty;
          break;
        }
      }
      player.blinkBonusReady = true;
      player.abilityActive = true;
      setTimeout(() => { player.abilityActive = false; }, 150);
      player.abilityCooldownRemaining = PHANTOM_BLINK_COOLDOWN_MS;
      break;
    }

    case "Warden": {
      const gx = player.x + Math.cos(player.aimAngle) * WARDEN_GRENADE_RANGE;
      const gy = player.y + Math.sin(player.aimAngle) * WARDEN_GRENADE_RANGE;
      game.grenades.push({
        id: `g${grenadeIdCounter++}`,
        ownerId: player.id,
        x: clamp(gx, WALL_THICKNESS, MAP_WIDTH - WALL_THICKNESS),
        y: clamp(gy, WALL_THICKNESS, MAP_HEIGHT - WALL_THICKNESS),
        radius: WARDEN_GRENADE_RADIUS,
        remainingMs: WARDEN_GRENADE_DURATION_MS,
      });
      player.abilityActive = true;
      setTimeout(() => { player.abilityActive = false; }, 200);
      player.abilityCooldownRemaining = WARDEN_GRENADE_COOLDOWN_MS;
      break;
    }
  }
}

// ── Bullets ──

function updateBullets(game: ActiveGame, dt: number, now: number): void {
  const bulletsToRemove = new Set<string>();
  const newBullets: InternalBullet[] = []; // for ricochet spawns

  for (const bullet of game.bullets) {
    const moveDistX = bullet.vx * dt;
    const moveDistY = bullet.vy * dt;
    bullet.x += moveDistX;
    bullet.y += moveDistY;
    bullet.distanceTraveled += Math.sqrt(moveDistX * moveDistX + moveDistY * moveDistY);

    // Range check — remove bullet if past max range (0 = infinite)
    if (bullet.maxRange > 0 && bullet.distanceTraveled > bullet.maxRange) {
      bulletsToRemove.add(bullet.id); continue;
    }

    // Wall collision — bounce or remove
    const wallHit = getCollidingWall(bullet.x, bullet.y, BULLET_RADIUS);
    if (wallHit) {
      if (bullet.bouncesRemaining > 0) {
        bullet.bouncesRemaining--;
        bullet.damage *= 1 - AUG_BOUNCY_WALL_DAMAGE_PENALTY;
        bounceBulletOffWall(bullet, wallHit);
      } else {
        bulletsToRemove.add(bullet.id); continue;
      }
    }

    if (bullet.x < 0 || bullet.x > MAP_WIDTH || bullet.y < 0 || bullet.y > MAP_HEIGHT) {
      bulletsToRemove.add(bullet.id); continue;
    }

    // Player collision
    for (const player of game.players.values()) {
      if (!player.alive || player.id === bullet.ownerId) continue;
      const owner = game.players.get(bullet.ownerId);
      if (owner && isSameTeam(owner, player, game.gameMode)) continue;

      const dx = player.x - bullet.x;
      const dy = player.y - bullet.y;
      const hitRadius = player.playerRadius + BULLET_RADIUS;

      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        // Shield Guard blocks the bullet
        if (player.shieldGuardActive) {
          player.shieldGuardActive = false;
          player.shieldGuardCooldownMs = AUG_SHIELD_GUARD_COOLDOWN_MS;
          player.damageFlashMs = 80;
          bulletsToRemove.add(bullet.id);
          break;
        }

        let damage = bullet.damage;

        // Armor reduction (LoL formula: reduction = armor / (armor + 100))
        if (player.armor > 0) {
          damage *= ARMOR_FORMULA_CONSTANT / (ARMOR_FORMULA_CONSTANT + player.armor);
        }

        // Bruiser passive
        if (player.character === "Bruiser" && player.hp / player.maxHp < BRUISER_PASSIVE_THRESHOLD) {
          damage *= 1 - BRUISER_PASSIVE_REDUCTION;
        }

        player.hp -= damage;
        player.lastDamageTime = now;
        player.damageFlashMs = 150;

        if (owner) owner.damageDealt += damage;

        // Freeze augment: on hit, apply freeze slow
        if (owner && hasAugment(owner, "Freeze")) {
          player.freezeRemainingMs = AUG_FREEZE_DURATION_MS;
        }

        // Blaze augment: on hit, apply burn DoT
        if (owner && hasAugment(owner, "Blaze")) {
          player.burnRemainingMs = AUG_BLAZE_DURATION_MS;
          player.burnDamagePerTick = owner.effectiveDamage * AUG_BLAZE_DPS_PERCENT;
        }

        // Ricochet: spawn a new bullet toward nearest enemy
        if (owner && hasAugment(owner, "Ricochet")) {
          const ricTarget = findNearestEnemy(player.x, player.y, bullet.ownerId, game, AUG_RICOCHET_RANGE);
          if (ricTarget) {
            const rdx = ricTarget.x - player.x;
            const rdy = ricTarget.y - player.y;
            const rLen = Math.sqrt(rdx * rdx + rdy * rdy);
            if (rLen > 0) {
              newBullets.push({
                id: `b${bulletIdCounter++}`,
                ownerId: bullet.ownerId,
                x: player.x, y: player.y,
                vx: (rdx / rLen) * BULLET_SPEED,
                vy: (rdy / rLen) * BULLET_SPEED,
                damage: damage * (1 - AUG_RICOCHET_DAMAGE_PENALTY),
                bouncesRemaining: 0,
                piercing: false,
                distanceTraveled: 0,
                maxRange: bullet.maxRange,
              });
            }
          }
        }

        if (player.hp <= 0) {
          player.hp = 0;
          player.alive = false;
          player.deaths++;
          player.respawnTimer = RESPAWN_DELAY_MS;
          player.freezeRemainingMs = 0;
          player.burnRemainingMs = 0;

          game.totalDeaths.set(player.id, (game.totalDeaths.get(player.id) ?? 0) + 1);

          if (owner) {
            owner.kills++;
            game.roundKills.set(owner.id, (game.roundKills.get(owner.id) ?? 0) + 1);
            game.totalKills.set(owner.id, (game.totalKills.get(owner.id) ?? 0) + 1);
            game.killFeed.push({ killerId: owner.id, victimId: player.id, timestamp: now });
            if (game.killFeed.length > KILL_FEED_MAX) game.killFeed.shift();

            // Death Nova: killed enemy explodes into projectiles
            if (hasAugment(owner, "DeathNova")) {
              const novaDmg = owner.effectiveDamage * AUG_DEATH_NOVA_DAMAGE_PERCENT;
              for (let ni = 0; ni < AUG_DEATH_NOVA_PROJECTILES; ni++) {
                const novaAngle = (ni / AUG_DEATH_NOVA_PROJECTILES) * Math.PI * 2;
                newBullets.push({
                  id: `b${bulletIdCounter++}`,
                  ownerId: owner.id,
                  x: player.x, y: player.y,
                  vx: Math.cos(novaAngle) * BULLET_SPEED * 0.8,
                  vy: Math.sin(novaAngle) * BULLET_SPEED * 0.8,
                  damage: novaDmg,
                  bouncesRemaining: 0,
                  piercing: false,
                  distanceTraveled: 0,
                  maxRange: 300, // nova bullets have limited range
                });
              }
            }
          }
        }

        // Piercing: don't remove bullet, reduce damage, continue to next player
        if (bullet.piercing) {
          bullet.damage *= 1 - AUG_PIERCING_DAMAGE_PENALTY;
          bullet.piercing = false; // can only pierce once
          // Don't break — but don't hit same player twice per frame
          continue;
        }

        bulletsToRemove.add(bullet.id);
        break;
      }
    }
  }

  game.bullets = game.bullets.filter((b) => !bulletsToRemove.has(b.id));
  // Add ricochet + death nova bullets
  if (newBullets.length > 0) game.bullets.push(...newBullets);
}

function findNearestEnemy(x: number, y: number, excludeId: string, game: ActiveGame, maxRange: number): InternalPlayer | null {
  let best: InternalPlayer | null = null;
  let bestDistSq = maxRange * maxRange;
  for (const p of game.players.values()) {
    if (!p.alive || p.id === excludeId) continue;
    const dx = p.x - x;
    const dy = p.y - y;
    const dSq = dx * dx + dy * dy;
    if (dSq < bestDistSq) { bestDistSq = dSq; best = p; }
  }
  return best;
}

function getCollidingWall(cx: number, cy: number, radius: number): Rect | null {
  for (const wall of walls) {
    const nearestX = clamp(cx, wall.x, wall.x + wall.w);
    const nearestY = clamp(cy, wall.y, wall.y + wall.h);
    const dx = cx - nearestX;
    const dy = cy - nearestY;
    if (dx * dx + dy * dy <= radius * radius) return wall;
  }
  return null;
}

function bounceBulletOffWall(bullet: InternalBullet, wall: Rect): void {
  const cx = bullet.x; const cy = bullet.y;
  const dL = Math.abs(cx - wall.x);
  const dR = Math.abs(cx - (wall.x + wall.w));
  const dT = Math.abs(cy - wall.y);
  const dB = Math.abs(cy - (wall.y + wall.h));
  const minD = Math.min(dL, dR, dT, dB);

  if (minD === dL || minD === dR) {
    bullet.vx = -bullet.vx;
    bullet.x = minD === dL ? wall.x - BULLET_RADIUS - 1 : wall.x + wall.w + BULLET_RADIUS + 1;
  } else {
    bullet.vy = -bullet.vy;
    bullet.y = minD === dT ? wall.y - BULLET_RADIUS - 1 : wall.y + wall.h + BULLET_RADIUS + 1;
  }
}

function respawnPlayer(player: InternalPlayer, game: ActiveGame): void {
  player.hp = player.effectiveMaxHp;
  player.maxHp = player.effectiveMaxHp;
  player.alive = true;
  player.blinkBonusReady = false;
  player.knockbackVx = 0;
  player.knockbackVy = 0;
  player.slowMultiplier = 1;
  player.damageFlashMs = 0;
  player.freezeRemainingMs = 0;
  player.burnRemainingMs = 0;
  player.burnDamagePerTick = 0;
  if (hasAugment(player, "ShieldGuard")) {
    player.shieldGuardActive = true;
    player.shieldGuardCooldownMs = 0;
  }
  const spawn = getRespawnPosition(player, game);
  player.x = spawn.x;
  player.y = spawn.y;
}

// ── Collision helpers ──

function circleCollidesWalls(cx: number, cy: number, radius: number): boolean {
  return getCollidingWall(cx, cy, radius) !== null;
}

function isSameTeam(a: InternalPlayer, b: InternalPlayer, mode: GameMode): boolean {
  if (mode !== "TeamDeathmatch") return false;
  return a.team !== 0 && a.team === b.team;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── Build client-facing state ──

function buildGameState(game: ActiveGame): GameState {
  const players: PlayerState[] = [];
  for (const p of game.players.values()) {
    players.push({
      id: p.id, name: p.name, x: p.x, y: p.y,
      hp: p.hp, maxHp: p.maxHp,
      character: p.character, team: p.team,
      aimAngle: p.aimAngle, alive: p.alive,
      kills: p.kills, deaths: p.deaths,
      abilityCooldownRemaining: p.abilityCooldownRemaining,
      abilityActive: p.abilityActive,
      blinkBonusReady: p.blinkBonusReady,
      slowed: p.slowMultiplier < 1,
      damageDealt: Math.round(p.damageDealt),
      damageFlashMs: p.damageFlashMs,
      augments: p.augments,
      critChance: p.critChance,
      armor: p.armor,
      range: p.effectiveRange,
      burning: p.burnRemainingMs > 0,
      frozen: p.freezeRemainingMs > 0,
      shieldGuardReady: p.shieldGuardActive,
      playerRadius: p.playerRadius,
      stats: {
        health: p.effectiveMaxHp,
        attackDamage: Math.round(p.effectiveDamage * 10) / 10,
        attackSpeed: Math.round((1000 / p.effectiveShootCooldown) * 10) / 10,
        armor: p.armor,
        movementSpeed: Math.round(p.effectiveSpeed),
        range: p.effectiveRange,
      },
    });
  }

  const bullets: BulletState[] = game.bullets.map((b) => ({
    id: b.id, ownerId: b.ownerId,
    x: b.x, y: b.y, vx: b.vx, vy: b.vy,
    damage: b.damage, bouncesRemaining: b.bouncesRemaining,
    piercing: b.piercing,
  }));

  const pulseGrenades: PulseGrenadeState[] = game.grenades.map((g) => ({
    id: g.id, ownerId: g.ownerId,
    x: g.x, y: g.y, radius: g.radius, remainingMs: g.remainingMs,
  }));

  return {
    phase: "combat",
    roundNumber: game.roundNumber,
    players, bullets, pulseGrenades,
    killFeed: game.killFeed,
    walls, mapWidth: MAP_WIDTH, mapHeight: MAP_HEIGHT,
    timeRemainingMs: game.roundTimeRemainingMs,
    roomCode: game.roomCode,
    gameMode: game.gameMode,
  };
}
