import type {
  GameMode,
  GameState,
  PlayerState,
  BulletState,
  KillFeedEntry,
  InputPayload,
  Rect,
  RoomState,
  GameOverData,
  MatchPhase,
  AugmentId,
  AugmentTier,
  AugmentCard,
  AugmentDefinition,
  DraftState,
  RoundResultState,
  TeamState,
  RoundMatchup,
} from "@arenaz/types";
import {
  MAP_WIDTH, MAP_HEIGHT, WALL_THICKNESS, TICK_MS,
  PLAYER_RADIUS, BULLET_SPEED, BULLET_RADIUS, SHOOT_COOLDOWN_MS,
  KILL_FEED_MAX, KILL_FEED_DURATION_MS,
  MAX_ROUNDS, COMBAT_DURATION_S, DRAFT_DURATION_MS, ROUND_RESULT_DURATION_MS,
  DRAFT_REROLLS_PER_CARD, DRAFT_CARDS_OFFERED,
  BASE_PLAYER_HP, BASE_PLAYER_SPEED, BASE_PLAYER_DAMAGE,
  MAX_LEVEL, HP_PER_LEVEL, DAMAGE_PER_LEVEL, SPEED_PER_LEVEL,
  TEAM_HEALTH_START, TEAM_DAMAGE_SCHEDULE,
  FFA_TEAM_COLORS, FFA_TEAM_COLOR_NAMES, DUO_TEAM_COLORS, DUO_TEAM_COLOR_NAMES,
  BASE_BULLET_RANGE, ARMOR_FORMULA_CONSTANT,
  AUG_ATTACK_BOOST, AUG_SPEED_BOOST, AUG_SPEED_CAP, AUG_HP_BOOST,
  AUG_ATTACK_SPEED_BOOST, AUG_ATTACK_SPEED_FLOOR_MS,
  AUG_CRIT_CHANCE, AUG_CRIT_MULTIPLIER, AUG_CRIT_CAP,
  AUG_ARMOR_BOOST, AUG_RANGE_BOOST_SMALL, AUG_RANGE_BOOST_MEDIUM, AUG_SNIPER_RANGE,
  AUG_MULTISHOT_SPREAD_BASE, AUG_MULTISHOT_DAMAGE_PENALTY,
  AUG_RICOCHET_DAMAGE_PENALTY, AUG_RICOCHET_RANGE,
  AUG_PIERCING_DAMAGE_PENALTY, AUG_BOUNCY_WALL_BOUNCES, AUG_BOUNCY_WALL_DAMAGE_PENALTY,
  AUG_FREEZE_SLOW, AUG_FREEZE_DURATION_MS, AUG_BLAZE_DPS_PERCENT, AUG_BLAZE_DURATION_MS,
  AUG_FRONT_ARROW_DAMAGE_PENALTY, AUG_SIDE_ARROWS_ANGLE, AUG_SIDE_ARROWS_DAMAGE_PENALTY,
  AUG_DEATH_NOVA_PROJECTILES, AUG_DEATH_NOVA_DAMAGE_PERCENT,
  AUG_SHIELD_GUARD_COOLDOWN_MS, AUG_GIANT_DAMAGE_BOOST, AUG_GIANT_HP_BOOST, AUG_GIANT_RADIUS_MULTIPLIER,
} from "@arenaz/types/src/constants.js";

// ── Map walls ──
const walls: Rect[] = [
  { x: 0, y: 0, w: MAP_WIDTH, h: WALL_THICKNESS },
  { x: 0, y: MAP_HEIGHT - WALL_THICKNESS, w: MAP_WIDTH, h: WALL_THICKNESS },
  { x: 0, y: 0, w: WALL_THICKNESS, h: MAP_HEIGHT },
  { x: MAP_WIDTH - WALL_THICKNESS, y: 0, w: WALL_THICKNESS, h: MAP_HEIGHT },
  { x: 300, y: 250, w: 200, h: 30 }, { x: 1100, y: 250, w: 200, h: 30 },
  { x: 300, y: 920, w: 200, h: 30 }, { x: 1100, y: 920, w: 200, h: 30 },
  { x: 750, y: 500, w: 100, h: 30 }, { x: 750, y: 670, w: 100, h: 30 },
  { x: 700, y: 550, w: 30, h: 100 }, { x: 870, y: 550, w: 30, h: 100 },
  { x: 200, y: 550, w: 40, h: 100 }, { x: 1360, y: 550, w: 40, h: 100 },
  { x: 100, y: 100, w: 60, h: 60 }, { x: MAP_WIDTH - 160, y: 100, w: 60, h: 60 },
  { x: 100, y: MAP_HEIGHT - 160, w: 60, h: 60 }, { x: MAP_WIDTH - 160, y: MAP_HEIGHT - 160, w: 60, h: 60 },
];

const INPUT_STALE_MS = 150;

// ── Augment definitions ──
function randomTier(): AugmentTier {
  const roll = Math.random();
  if (roll < 1 / 3) return "Silver";
  if (roll < 2 / 3) return "Gold";
  return "Prismatic";
}

const ALL_AUGMENTS: AugmentDefinition[] = [
  { id: "AttackBoost", name: "Attack Boost", tier: "Silver", description: "+15% damage", stackable: true },
  { id: "SpeedBoost", name: "Speed Boost", tier: "Silver", description: "+15% movement speed", stackable: true },
  { id: "HpBoost", name: "HP Boost", tier: "Silver", description: "+20% max HP", stackable: true },
  { id: "AttackSpeedBoost", name: "Attack Speed", tier: "Silver", description: "+15% fire rate", stackable: true },
  { id: "CritChance", name: "Critical Hit", tier: "Silver", description: "+10% crit chance", stackable: true },
  { id: "ArmorBoost", name: "Armor", tier: "Silver", description: "+15 armor", stackable: true },
  { id: "RangeBoostSmall", name: "Range+", tier: "Silver", description: "+150 range", stackable: true },
  { id: "Multishot", name: "Multishot", tier: "Gold", description: "+1 bullet per shot", stackable: true },
  { id: "Ricochet", name: "Ricochet", tier: "Gold", description: "Bullets bounce to enemies", stackable: false },
  { id: "PiercingShot", name: "Piercing", tier: "Gold", description: "Bullets pierce enemies", stackable: false },
  { id: "BouncyWall", name: "Bouncy Wall", tier: "Gold", description: "Bullets bounce off walls", stackable: false },
  { id: "Freeze", name: "Freeze", tier: "Gold", description: "Hits slow enemies", stackable: false },
  { id: "Blaze", name: "Blaze", tier: "Gold", description: "Hits burn enemies", stackable: false },
  { id: "RangeBoostMedium", name: "Extended Range", tier: "Gold", description: "+400 range", stackable: false },
  { id: "FrontArrow", name: "Front Arrow", tier: "Prismatic", description: "+1 forward bullet", stackable: false },
  { id: "SideArrows", name: "Side Arrows", tier: "Prismatic", description: "+2 side bullets", stackable: false },
  { id: "DeathNova", name: "Death Nova", tier: "Prismatic", description: "Kill explosions", stackable: false },
  { id: "ShieldGuard", name: "Shield Guard", tier: "Prismatic", description: "Block 1 bullet/8s", stackable: false },
  { id: "Giant", name: "Giant", tier: "Prismatic", description: "+40% dmg, bigger hitbox", stackable: false },
  { id: "Sniper", name: "Sniper", tier: "Prismatic", description: "Infinite range", stackable: false },
];

// ── Internal types ──
interface InternalPlayer {
  id: string; name: string;
  x: number; y: number; hp: number; maxHp: number;
  team: number; level: number;
  aimAngle: number; alive: boolean; onBye: boolean;
  kills: number; deaths: number; damageDealt: number;
  baseSpeed: number; baseDamage: number;
  input: InputPayload; inputReceivedAt: number;
  shootCooldownRemaining: number;
  knockbackVx: number; knockbackVy: number;
  slowMultiplier: number; damageFlashMs: number;
  augments: AugmentId[];
  effectiveSpeed: number; effectiveDamage: number; effectiveMaxHp: number;
  effectiveShootCooldown: number; critChance: number; armor: number;
  effectiveRange: number; playerRadius: number;
  shieldGuardActive: boolean; shieldGuardCooldownMs: number;
  freezeRemainingMs: number; burnRemainingMs: number; burnDamagePerTick: number;
}

interface InternalBullet {
  id: string; ownerId: string;
  x: number; y: number; vx: number; vy: number;
  damage: number; bouncesRemaining: number; piercing: boolean;
  distanceTraveled: number; maxRange: number;
}

interface InternalTeam {
  teamNumber: number; health: number; eliminated: boolean;
  eliminationOrder: number; playerIds: string[];
  color: number; colorName: string;
}

interface ActiveGame {
  roomCode: string; gameMode: GameMode;
  players: Map<string, InternalPlayer>;
  bullets: InternalBullet[];
  killFeed: KillFeedEntry[];
  nextBulletId: number;
  intervalId: ReturnType<typeof setInterval>;
  tickCounter: number;
  phase: MatchPhase; roundNumber: number;
  roundTimeRemainingMs: number; draftTimeRemainingMs: number; resultTimeRemainingMs: number;
  matchStartTime: number; currentLevel: number;
  // Teams
  teams: Map<number, InternalTeam>;
  matchups: RoundMatchup[];
  matchupHistory: Set<string>;
  eliminationCounter: number;
  // Draft (per-player)
  playerDraftCards: Map<string, AugmentCard[]>;
  playerCardRerolls: Map<string, number[]>;
  draftSelections: Map<string, AugmentId | null>;
  draftTier: AugmentTier;
  // Per-round kill tracking
  roundKills: Map<string, number>;
  totalKills: Map<string, number>;
  totalDeaths: Map<string, number>;
  // Broadcasts
  broadcastGameState: (roomCode: string, state: GameState) => void;
  broadcastDraftStateToPlayer: (roomCode: string, playerId: string, state: DraftState) => void;
  broadcastRoundResult: (roomCode: string, state: RoundResultState) => void;
  broadcastGameOver: (roomCode: string, data: GameOverData) => void;
}

const activeGames: Map<string, ActiveGame> = new Map();
let bulletIdCounter = 0;

// ── Stats ──
function getStatsForLevel(level: number): { hp: number; speed: number; damage: number } {
  const lvl = Math.min(level, MAX_LEVEL);
  return {
    hp: BASE_PLAYER_HP + HP_PER_LEVEL * (lvl - 1),
    speed: BASE_PLAYER_SPEED + SPEED_PER_LEVEL * (lvl - 1),
    damage: BASE_PLAYER_DAMAGE + DAMAGE_PER_LEVEL * (lvl - 1),
  };
}

// ── Spawns ──
const SPAWN_POINTS = [
  { x: 250, y: 400 }, { x: 1350, y: 400 },
  { x: 250, y: 700 }, { x: 1350, y: 700 },
  { x: 800, y: 350 }, { x: 800, y: 850 },
];

// ── Create game ──
export function createGame(
  room: RoomState,
  broadcastGameState: (roomCode: string, state: GameState) => void,
  broadcastDraftStateToPlayer: (roomCode: string, playerId: string, state: DraftState) => void,
  broadcastRoundResult: (roomCode: string, state: RoundResultState) => void,
  broadcastGameOver: (roomCode: string, data: GameOverData) => void,
): void {
  const players = new Map<string, InternalPlayer>();
  const teams = new Map<number, InternalTeam>();
  const totalKills = new Map<string, number>();
  const totalDeaths = new Map<string, number>();
  const roundKills = new Map<string, number>();

  // Build teams
  const teamColors = room.gameMode === "FFA" ? FFA_TEAM_COLORS : DUO_TEAM_COLORS;
  const teamNames = room.gameMode === "FFA" ? FFA_TEAM_COLOR_NAMES : DUO_TEAM_COLOR_NAMES;
  const teamPlayerMap = new Map<number, string[]>();

  for (const lp of room.players) {
    if (!teamPlayerMap.has(lp.team)) teamPlayerMap.set(lp.team, []);
    teamPlayerMap.get(lp.team)!.push(lp.id);
  }

  for (const [teamNum, playerIds] of teamPlayerMap.entries()) {
    teams.set(teamNum, {
      teamNumber: teamNum,
      health: TEAM_HEALTH_START,
      eliminated: false,
      eliminationOrder: 0,
      playerIds,
      color: teamColors[(teamNum - 1) % teamColors.length],
      colorName: teamNames[(teamNum - 1) % teamNames.length],
    });
  }

  const stats = getStatsForLevel(1);
  room.players.forEach((lp, i) => {
    const spawn = SPAWN_POINTS[i % SPAWN_POINTS.length];
    players.set(lp.id, createPlayer(lp.id, lp.name, spawn.x, spawn.y, lp.team, stats));
    totalKills.set(lp.id, 0); totalDeaths.set(lp.id, 0); roundKills.set(lp.id, 0);
  });

  const game: ActiveGame = {
    roomCode: room.code, gameMode: room.gameMode,
    players, bullets: [], killFeed: [],
    nextBulletId: 0, intervalId: null!, tickCounter: 0,
    phase: "draft", roundNumber: 1,
    roundTimeRemainingMs: COMBAT_DURATION_S * 1000,
    draftTimeRemainingMs: DRAFT_DURATION_MS,
    resultTimeRemainingMs: ROUND_RESULT_DURATION_MS,
    matchStartTime: Date.now(), currentLevel: 1,
    teams, matchups: [], matchupHistory: new Set(), eliminationCounter: 0,
    playerDraftCards: new Map(), playerCardRerolls: new Map(),
    draftSelections: new Map(), draftTier: "Silver",
    roundKills, totalKills, totalDeaths,
    broadcastGameState, broadcastDraftStateToPlayer, broadcastRoundResult, broadcastGameOver,
  };

  startDraftPhase(game);
  game.intervalId = setInterval(() => tick(game), TICK_MS);
  activeGames.set(room.code, game);
}

function createPlayer(id: string, name: string, x: number, y: number, team: number, stats: { hp: number; speed: number; damage: number }): InternalPlayer {
  return {
    id, name, x, y, hp: stats.hp, maxHp: stats.hp, team, level: 1,
    aimAngle: 0, alive: true, onBye: false,
    kills: 0, deaths: 0, damageDealt: 0,
    baseSpeed: stats.speed, baseDamage: stats.damage,
    input: { dx: 0, dy: 0, aimAngle: 0, shoot: false }, inputReceivedAt: Date.now(),
    shootCooldownRemaining: 0, knockbackVx: 0, knockbackVy: 0,
    slowMultiplier: 1, damageFlashMs: 0, augments: [],
    effectiveSpeed: stats.speed, effectiveDamage: stats.damage,
    effectiveMaxHp: stats.hp, effectiveShootCooldown: SHOOT_COOLDOWN_MS,
    critChance: 0, armor: 0, effectiveRange: BASE_BULLET_RANGE,
    playerRadius: PLAYER_RADIUS,
    shieldGuardActive: false, shieldGuardCooldownMs: 0,
    freezeRemainingMs: 0, burnRemainingMs: 0, burnDamagePerTick: 0,
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
  if (game.draftSelections.get(playerId) !== null) return;
  const cards = game.playerDraftCards.get(playerId);
  if (!cards || !cards.some((c) => c.id === augmentId)) return;
  game.draftSelections.set(playerId, augmentId);
  const player = game.players.get(playerId);
  if (player) player.augments.push(augmentId);
  if (Array.from(game.draftSelections.values()).every((v) => v !== null)) startCombatPhase(game);
}

export function handleReroll(roomCode: string, playerId: string, cardIndex: number): void {
  const game = activeGames.get(roomCode);
  if (!game || game.phase !== "draft") return;
  if (game.draftSelections.get(playerId) !== null) return;
  const cards = game.playerDraftCards.get(playerId);
  const rerolls = game.playerCardRerolls.get(playerId);
  if (!cards || !rerolls || cardIndex < 0 || cardIndex >= cards.length || rerolls[cardIndex] <= 0) return;
  rerolls[cardIndex]--;
  const currentIds = new Set(cards.map((c) => c.id));
  const pool = ALL_AUGMENTS.filter((a) => a.tier === game.draftTier && !currentIds.has(a.id));
  if (pool.length > 0) {
    const r = pool[Math.floor(Math.random() * pool.length)];
    cards[cardIndex] = { id: r.id, name: r.name, tier: r.tier, description: r.description };
  }
  broadcastDraft(game);
}

export function removePlayerFromGame(roomCode: string, playerId: string): void {
  const game = activeGames.get(roomCode);
  if (!game) return;
  game.players.delete(playerId);
  game.bullets = game.bullets.filter((b) => b.ownerId !== playerId);
  if (game.players.size === 0) { clearInterval(game.intervalId); activeGames.delete(roomCode); }
}

export function stopGame(roomCode: string): void {
  const game = activeGames.get(roomCode);
  if (!game) return;
  clearInterval(game.intervalId); activeGames.delete(roomCode);
}

export function isGameActive(roomCode: string): boolean { return activeGames.has(roomCode); }

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

function tickDraft(game: ActiveGame): void {
  game.draftTimeRemainingMs -= TICK_MS;
  if (Math.floor(game.draftTimeRemainingMs / TICK_MS) % 10 === 0) broadcastDraft(game);
  if (game.draftTimeRemainingMs <= 0) {
    for (const [pid, sel] of game.draftSelections.entries()) {
      if (sel === null) {
        const cards = game.playerDraftCards.get(pid);
        if (cards && cards.length > 0) {
          const auto = cards[Math.floor(Math.random() * cards.length)];
          game.draftSelections.set(pid, auto.id);
          const p = game.players.get(pid);
          if (p) p.augments.push(auto.id);
        }
      }
    }
    startCombatPhase(game);
  }
}

function broadcastDraft(game: ActiveGame): void {
  const selections: Record<string, AugmentId | null> = {};
  for (const [id, sel] of game.draftSelections.entries()) selections[id] = sel;
  for (const pid of game.players.keys()) {
    const cards = game.playerDraftCards.get(pid) ?? [];
    const rerolls = game.playerCardRerolls.get(pid) ?? [];
    game.broadcastDraftStateToPlayer(game.roomCode, pid, {
      phase: "draft", roundNumber: game.roundNumber, tier: game.draftTier,
      cards, cardRerolls: rerolls, timerMs: game.draftTimeRemainingMs, selections,
    });
  }
}

// ══════════════════════════════════
// ── Matchmaking (round-robin) ──
// ══════════════════════════════════
function generateMatchups(game: ActiveGame): RoundMatchup[] {
  const alive = Array.from(game.teams.values()).filter((t) => !t.eliminated).map((t) => t.teamNumber);
  const matchups: RoundMatchup[] = [];
  const used = new Set<number>();

  // Try to pair teams that haven't fought yet
  for (let i = 0; i < alive.length; i++) {
    if (used.has(alive[i])) continue;
    for (let j = i + 1; j < alive.length; j++) {
      if (used.has(alive[j])) continue;
      const key = `${Math.min(alive[i], alive[j])}-vs-${Math.max(alive[i], alive[j])}`;
      if (!game.matchupHistory.has(key)) {
        matchups.push({ team1: alive[i], team2: alive[j] });
        game.matchupHistory.add(key);
        used.add(alive[i]); used.add(alive[j]);
        break;
      }
    }
  }

  // If not enough pairs found (all have fought), reset history and try again
  if (matchups.length === 0 && alive.length >= 2) {
    game.matchupHistory.clear();
    return generateMatchups(game);
  }

  // Pair remaining unpaired teams (fallback)
  const unpaired = alive.filter((t) => !used.has(t));
  for (let i = 0; i + 1 < unpaired.length; i += 2) {
    matchups.push({ team1: unpaired[i], team2: unpaired[i + 1] });
    const key = `${Math.min(unpaired[i], unpaired[i + 1])}-vs-${Math.max(unpaired[i], unpaired[i + 1])}`;
    game.matchupHistory.add(key);
  }

  return matchups;
}

// ══════════════════════════════════
// ── Combat Phase ──
// ══════════════════════════════════
function startCombatPhase(game: ActiveGame): void {
  game.phase = "combat";
  game.roundTimeRemainingMs = COMBAT_DURATION_S * 1000;
  game.bullets = []; game.killFeed = [];
  for (const id of game.players.keys()) game.roundKills.set(id, 0);

  // Level up
  game.currentLevel = Math.min(game.roundNumber, MAX_LEVEL);
  const stats = getStatsForLevel(game.currentLevel);

  // Generate matchups
  game.matchups = generateMatchups(game);
  const fightingTeams = new Set<number>();
  for (const m of game.matchups) { fightingTeams.add(m.team1); fightingTeams.add(m.team2); }

  // Reset players
  let spawnIdx = 0;
  for (const player of game.players.values()) {
    player.level = game.currentLevel;
    player.baseSpeed = stats.speed;
    player.baseDamage = stats.damage;
    const spawn = SPAWN_POINTS[spawnIdx++ % SPAWN_POINTS.length];
    player.x = spawn.x; player.y = spawn.y;
    player.alive = true;
    player.onBye = !fightingTeams.has(player.team);
    player.knockbackVx = 0; player.knockbackVy = 0;
    player.slowMultiplier = 1; player.damageFlashMs = 0;
    player.shootCooldownRemaining = 0;
    player.freezeRemainingMs = 0; player.burnRemainingMs = 0; player.burnDamagePerTick = 0;
    recalculatePlayerStats(player);
  }
}

function tickCombat(game: ActiveGame): void {
  const dt = TICK_MS / 1000;
  const now = Date.now();
  game.roundTimeRemainingMs -= TICK_MS;
  game.killFeed = game.killFeed.filter((e) => now - e.timestamp < KILL_FEED_DURATION_MS);

  for (const player of game.players.values()) {
    if (!player.alive || player.onBye) continue;

    player.damageFlashMs = Math.max(0, player.damageFlashMs - TICK_MS);
    player.shootCooldownRemaining = Math.max(0, player.shootCooldownRemaining - TICK_MS);

    // Freeze/burn ticks
    if (player.freezeRemainingMs > 0) {
      player.freezeRemainingMs -= TICK_MS;
      player.slowMultiplier = Math.min(player.slowMultiplier, 1 - AUG_FREEZE_SLOW);
    } else {
      player.slowMultiplier = 1;
    }
    if (player.burnRemainingMs > 0) {
      player.burnRemainingMs -= TICK_MS;
      player.hp -= player.burnDamagePerTick * dt;
      if (player.hp <= 0) { player.hp = 0; player.alive = false; player.deaths++; game.totalDeaths.set(player.id, (game.totalDeaths.get(player.id) ?? 0) + 1); }
    }

    if (hasAugment(player, "ShieldGuard") && !player.shieldGuardActive) {
      player.shieldGuardCooldownMs -= TICK_MS;
      if (player.shieldGuardCooldownMs <= 0) player.shieldGuardActive = true;
    }

    if (!player.alive) continue;

    // Movement (WASD only, axis-separated collision)
    const input = player.input;
    player.aimAngle = input.aimAngle;
    const inputFresh = (now - player.inputReceivedAt) < INPUT_STALE_MS;
    const rawDx = inputFresh ? input.dx : 0;
    const rawDy = inputFresh ? input.dy : 0;
    const inputLen = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
    const ndx = inputLen > 0 ? rawDx / inputLen : 0;
    const ndy = inputLen > 0 ? rawDy / inputLen : 0;
    const speed = player.effectiveSpeed * player.slowMultiplier;
    const moveX = ndx * speed * dt + player.knockbackVx * dt;
    const moveY = ndy * speed * dt + player.knockbackVy * dt;
    player.knockbackVx *= 0.85; player.knockbackVy *= 0.85;
    if (Math.abs(player.knockbackVx) < 1) player.knockbackVx = 0;
    if (Math.abs(player.knockbackVy) < 1) player.knockbackVy = 0;
    const pr = player.playerRadius;
    const newX = player.x + moveX;
    if (!circleCollidesWalls(newX, player.y, pr)) player.x = newX;
    const newY = player.y + moveY;
    if (!circleCollidesWalls(player.x, newY, pr)) player.y = newY;

    // Shooting
    if (inputFresh && input.shoot && player.shootCooldownRemaining <= 0) {
      let baseDmg = player.effectiveDamage;
      if (hasAugment(player, "FrontArrow")) baseDmg *= 1 - AUG_FRONT_ARROW_DAMAGE_PENALTY;
      const bounces = hasAugment(player, "BouncyWall") ? AUG_BOUNCY_WALL_BOUNCES : 0;
      const isPiercing = hasAugment(player, "PiercingShot");
      const bulletSpecs: { angle: number; damage: number }[] = [{ angle: input.aimAngle, damage: baseDmg }];
      if (hasAugment(player, "FrontArrow")) bulletSpecs.push({ angle: input.aimAngle + 0.05, damage: baseDmg });
      const msLevel = countAugment(player, "Multishot");
      if (msLevel > 0) {
        const penalty = Math.max(0.3, 1 - AUG_MULTISHOT_DAMAGE_PENALTY * msLevel);
        const total = 1 + msLevel;
        const spread = AUG_MULTISHOT_SPREAD_BASE * msLevel;
        const base = input.aimAngle;
        const dmg = baseDmg * penalty;
        bulletSpecs.length = 0;
        for (let mi = 0; mi < total; mi++) {
          const off = (mi - (total - 1) / 2) * (spread / Math.max(total - 1, 1));
          bulletSpecs.push({ angle: base + off, damage: dmg });
        }
        if (hasAugment(player, "FrontArrow")) bulletSpecs.push({ angle: base + 0.05, damage: dmg });
      }
      if (hasAugment(player, "SideArrows")) {
        const sd = baseDmg * (1 - AUG_SIDE_ARROWS_DAMAGE_PENALTY);
        bulletSpecs.push({ angle: input.aimAngle + AUG_SIDE_ARROWS_ANGLE, damage: sd });
        bulletSpecs.push({ angle: input.aimAngle - AUG_SIDE_ARROWS_ANGLE, damage: sd });
      }
      for (const spec of bulletSpecs) {
        let dmg = spec.damage;
        if (player.critChance > 0 && Math.random() < player.critChance) dmg *= AUG_CRIT_MULTIPLIER;
        game.bullets.push({
          id: `b${bulletIdCounter++}`, ownerId: player.id,
          x: player.x + Math.cos(spec.angle) * (pr + BULLET_RADIUS + 2),
          y: player.y + Math.sin(spec.angle) * (pr + BULLET_RADIUS + 2),
          vx: Math.cos(spec.angle) * BULLET_SPEED, vy: Math.sin(spec.angle) * BULLET_SPEED,
          damage: dmg, bouncesRemaining: bounces, piercing: isPiercing,
          distanceTraveled: 0, maxRange: player.effectiveRange,
        });
      }
      player.shootCooldownRemaining = player.effectiveShootCooldown;
    }
  }

  updateBullets(game, dt, now);

  // Broadcast every 2nd tick (30hz)
  game.tickCounter++;
  if (game.tickCounter % 2 === 0) {
    game.broadcastGameState(game.roomCode, buildGameState(game));
  }

  // Check if all matchups are resolved (one team dead in each pair)
  if (game.roundTimeRemainingMs <= 0 || allMatchupsResolved(game)) {
    startRoundResultPhase(game);
  }
}

function allMatchupsResolved(game: ActiveGame): boolean {
  for (const m of game.matchups) {
    const t1Alive = Array.from(game.players.values()).filter((p) => p.team === m.team1 && p.alive).length;
    const t2Alive = Array.from(game.players.values()).filter((p) => p.team === m.team2 && p.alive).length;
    if (t1Alive > 0 && t2Alive > 0) return false; // still fighting
  }
  return true;
}

// ══════════════════════════════════
// ── Round Result ──
// ══════════════════════════════════
function startRoundResultPhase(game: ActiveGame): void {
  game.phase = "roundResult";
  game.resultTimeRemainingMs = ROUND_RESULT_DURATION_MS;

  const dmgAmount = TEAM_DAMAGE_SCHEDULE[Math.min(game.roundNumber - 1, TEAM_DAMAGE_SCHEDULE.length - 1)];
  const healthChanges: Record<number, number> = {};
  const eliminations: number[] = [];

  // Evaluate each matchup
  for (const m of game.matchups) {
    const t1Hp = Array.from(game.players.values()).filter((p) => p.team === m.team1).reduce((s, p) => s + Math.max(0, p.hp), 0);
    const t2Hp = Array.from(game.players.values()).filter((p) => p.team === m.team2).reduce((s, p) => s + Math.max(0, p.hp), 0);

    let loser: number;
    if (t1Hp > t2Hp) loser = m.team2;
    else if (t2Hp > t1Hp) loser = m.team1;
    else loser = Math.random() < 0.5 ? m.team1 : m.team2; // tie = random loser

    const loserTeam = game.teams.get(loser)!;
    loserTeam.health = Math.max(0, loserTeam.health - dmgAmount);
    healthChanges[loser] = -dmgAmount;

    if (loserTeam.health <= 0 && !loserTeam.eliminated) {
      loserTeam.eliminated = true;
      game.eliminationCounter++;
      loserTeam.eliminationOrder = game.eliminationCounter;
      eliminations.push(loser);
    }
  }

  const teamHealths: Record<number, number> = {};
  for (const t of game.teams.values()) teamHealths[t.teamNumber] = t.health;

  const rk: Record<string, number> = {};
  const tk: Record<string, number> = {};
  const td: Record<string, number> = {};
  for (const id of game.players.keys()) {
    rk[id] = game.roundKills.get(id) ?? 0;
    tk[id] = game.totalKills.get(id) ?? 0;
    td[id] = game.totalDeaths.get(id) ?? 0;
  }

  game.broadcastRoundResult(game.roomCode, {
    phase: "roundResult", roundNumber: game.roundNumber, timerMs: game.resultTimeRemainingMs,
    roundKills: rk, totalKills: tk, totalDeaths: td,
    matchups: game.matchups, teamHealthChanges: healthChanges, teamHealths, eliminations,
  });
}

function tickRoundResult(game: ActiveGame): void {
  game.resultTimeRemainingMs -= TICK_MS;
  if (game.resultTimeRemainingMs <= 0) {
    const aliveTeams = Array.from(game.teams.values()).filter((t) => !t.eliminated);
    if (aliveTeams.length <= 1 || game.roundNumber >= MAX_ROUNDS) {
      endMatch(game);
    } else {
      game.roundNumber++;
      startDraftPhase(game);
    }
  }
}

function endMatch(game: ActiveGame): void {
  game.phase = "matchOver";
  clearInterval(game.intervalId);

  // Build placements from elimination order (last eliminated = worse placement)
  const teamList = Array.from(game.teams.values());
  const alive = teamList.filter((t) => !t.eliminated);
  const eliminated = teamList.filter((t) => t.eliminated).sort((a, b) => b.eliminationOrder - a.eliminationOrder);
  const ordered = [...alive, ...eliminated];
  const teamPlacements = ordered.map((t, i) => ({ teamNumber: t.teamNumber, placement: i + 1, health: t.health }));
  const teamPlacementMap = new Map(teamPlacements.map((tp) => [tp.teamNumber, tp.placement]));

  game.broadcastGameOver(game.roomCode, {
    players: Array.from(game.players.values()).map((p) => ({
      id: p.id, name: p.name, team: p.team,
      placement: teamPlacementMap.get(p.team) ?? 99,
      kills: game.totalKills.get(p.id) ?? 0,
      deaths: game.totalDeaths.get(p.id) ?? 0,
      damageDealt: Math.round(p.damageDealt), augments: p.augments,
    })),
    gameMode: game.gameMode, matchDurationMs: Date.now() - game.matchStartTime,
    teamPlacements,
  });
  activeGames.delete(game.roomCode);
}

// ── Main tick router ──
function tick(game: ActiveGame): void {
  switch (game.phase) {
    case "draft": tickDraft(game); break;
    case "combat": tickCombat(game); break;
    case "roundResult": tickRoundResult(game); break;
  }
}

// ── Bullets ──
function updateBullets(game: ActiveGame, dt: number, now: number): void {
  const toRemove = new Set<string>();
  const newBullets: InternalBullet[] = [];

  for (const b of game.bullets) {
    const mx = b.vx * dt; const my = b.vy * dt;
    b.x += mx; b.y += my;
    b.distanceTraveled += Math.sqrt(mx * mx + my * my);
    if (b.maxRange > 0 && b.distanceTraveled > b.maxRange) { toRemove.add(b.id); continue; }

    const wallHit = getCollidingWall(b.x, b.y, BULLET_RADIUS);
    if (wallHit) {
      if (b.bouncesRemaining > 0) { b.bouncesRemaining--; b.damage *= 1 - AUG_BOUNCY_WALL_DAMAGE_PENALTY; bounceBullet(b, wallHit); }
      else { toRemove.add(b.id); continue; }
    }
    if (b.x < 0 || b.x > MAP_WIDTH || b.y < 0 || b.y > MAP_HEIGHT) { toRemove.add(b.id); continue; }

    for (const player of game.players.values()) {
      if (!player.alive || player.onBye || player.id === b.ownerId) continue;
      const owner = game.players.get(b.ownerId);
      if (owner && owner.team === player.team) continue; // no friendly fire

      const dx = player.x - b.x; const dy = player.y - b.y;
      if (dx * dx + dy * dy <= (player.playerRadius + BULLET_RADIUS) ** 2) {
        if (player.shieldGuardActive) {
          player.shieldGuardActive = false; player.shieldGuardCooldownMs = AUG_SHIELD_GUARD_COOLDOWN_MS;
          player.damageFlashMs = 80; toRemove.add(b.id); break;
        }
        let dmg = b.damage;
        if (player.armor > 0) dmg *= ARMOR_FORMULA_CONSTANT / (ARMOR_FORMULA_CONSTANT + player.armor);
        player.hp -= dmg; player.damageFlashMs = 150;
        if (owner) owner.damageDealt += dmg;

        if (owner && hasAugment(owner, "Freeze")) player.freezeRemainingMs = AUG_FREEZE_DURATION_MS;
        if (owner && hasAugment(owner, "Blaze")) { player.burnRemainingMs = AUG_BLAZE_DURATION_MS; player.burnDamagePerTick = owner.effectiveDamage * AUG_BLAZE_DPS_PERCENT; }

        if (owner && hasAugment(owner, "Ricochet")) {
          const target = findNearest(player.x, player.y, b.ownerId, player.team, game);
          if (target) {
            const rdx = target.x - player.x; const rdy = target.y - player.y;
            const rLen = Math.sqrt(rdx * rdx + rdy * rdy);
            if (rLen > 0) newBullets.push({ id: `b${bulletIdCounter++}`, ownerId: b.ownerId, x: player.x, y: player.y, vx: (rdx / rLen) * BULLET_SPEED, vy: (rdy / rLen) * BULLET_SPEED, damage: dmg * (1 - AUG_RICOCHET_DAMAGE_PENALTY), bouncesRemaining: 0, piercing: false, distanceTraveled: 0, maxRange: b.maxRange });
          }
        }

        if (player.hp <= 0) {
          player.hp = 0; player.alive = false; player.deaths++;
          game.totalDeaths.set(player.id, (game.totalDeaths.get(player.id) ?? 0) + 1);
          if (owner) {
            owner.kills++;
            game.roundKills.set(owner.id, (game.roundKills.get(owner.id) ?? 0) + 1);
            game.totalKills.set(owner.id, (game.totalKills.get(owner.id) ?? 0) + 1);
            game.killFeed.push({ killerId: owner.id, victimId: player.id, timestamp: now });
            if (game.killFeed.length > KILL_FEED_MAX) game.killFeed.shift();
            if (hasAugment(owner, "DeathNova")) {
              for (let ni = 0; ni < AUG_DEATH_NOVA_PROJECTILES; ni++) {
                const a = (ni / AUG_DEATH_NOVA_PROJECTILES) * Math.PI * 2;
                newBullets.push({ id: `b${bulletIdCounter++}`, ownerId: owner.id, x: player.x, y: player.y, vx: Math.cos(a) * BULLET_SPEED * 0.8, vy: Math.sin(a) * BULLET_SPEED * 0.8, damage: owner.effectiveDamage * AUG_DEATH_NOVA_DAMAGE_PERCENT, bouncesRemaining: 0, piercing: false, distanceTraveled: 0, maxRange: 300 });
              }
            }
          }
        }
        if (b.piercing) { b.damage *= 1 - AUG_PIERCING_DAMAGE_PENALTY; b.piercing = false; continue; }
        toRemove.add(b.id); break;
      }
    }
  }
  game.bullets = game.bullets.filter((x) => !toRemove.has(x.id));
  if (newBullets.length > 0) game.bullets.push(...newBullets);
}

function findNearest(x: number, y: number, excludeId: string, excludeTeam: number, game: ActiveGame): InternalPlayer | null {
  let best: InternalPlayer | null = null; let bestD = AUG_RICOCHET_RANGE ** 2;
  for (const p of game.players.values()) {
    if (!p.alive || p.id === excludeId || p.team === excludeTeam) continue;
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

// ── Augment helpers ──
function hasAugment(p: InternalPlayer, id: AugmentId): boolean { return p.augments.includes(id); }
function countAugment(p: InternalPlayer, id: AugmentId): number { return p.augments.filter((a) => a === id).length; }

function recalculatePlayerStats(player: InternalPlayer): void {
  const base = getStatsForLevel(player.level);
  let speedMul = 1, damageMul = 1, hpMul = 1, asMul = 1, crit = 0, radiusMul = 1, armor = 0, range = BASE_BULLET_RANGE;
  for (const aug of player.augments) {
    switch (aug) {
      case "AttackBoost": damageMul += AUG_ATTACK_BOOST; break;
      case "SpeedBoost": speedMul += AUG_SPEED_BOOST; break;
      case "HpBoost": hpMul += AUG_HP_BOOST; break;
      case "AttackSpeedBoost": asMul += AUG_ATTACK_SPEED_BOOST; break;
      case "CritChance": crit += AUG_CRIT_CHANCE; break;
      case "ArmorBoost": armor += AUG_ARMOR_BOOST; break;
      case "RangeBoostSmall": range += AUG_RANGE_BOOST_SMALL; break;
      case "RangeBoostMedium": range += AUG_RANGE_BOOST_MEDIUM; break;
      case "Sniper": range = AUG_SNIPER_RANGE; break;
      case "Giant": damageMul += AUG_GIANT_DAMAGE_BOOST; hpMul += AUG_GIANT_HP_BOOST; radiusMul = AUG_GIANT_RADIUS_MULTIPLIER; break;
    }
  }
  if (speedMul > AUG_SPEED_CAP) speedMul = AUG_SPEED_CAP;
  player.effectiveSpeed = base.speed * speedMul;
  player.effectiveDamage = base.damage * damageMul;
  player.effectiveMaxHp = Math.round(base.hp * hpMul);
  player.effectiveShootCooldown = Math.max(AUG_ATTACK_SPEED_FLOOR_MS, SHOOT_COOLDOWN_MS / asMul);
  player.critChance = Math.min(crit, AUG_CRIT_CAP);
  player.playerRadius = Math.round(PLAYER_RADIUS * radiusMul);
  player.armor = armor; player.effectiveRange = range;
  player.maxHp = player.effectiveMaxHp; player.hp = player.effectiveMaxHp;
  player.shieldGuardActive = hasAugment(player, "ShieldGuard"); player.shieldGuardCooldownMs = 0;
}

// ── Collision ──
function circleCollidesWalls(cx: number, cy: number, r: number): boolean { return getCollidingWall(cx, cy, r) !== null; }

function getCollidingWall(cx: number, cy: number, r: number): Rect | null {
  for (const w of walls) {
    const nx = clamp(cx, w.x, w.x + w.w); const ny = clamp(cy, w.y, w.y + w.h);
    const dx = cx - nx; const dy = cy - ny;
    if (dx * dx + dy * dy <= r * r) return w;
  }
  return null;
}

function bounceBullet(b: InternalBullet, w: Rect): void {
  const dL = Math.abs(b.x - w.x); const dR = Math.abs(b.x - (w.x + w.w));
  const dT = Math.abs(b.y - w.y); const dB = Math.abs(b.y - (w.y + w.h));
  const min = Math.min(dL, dR, dT, dB);
  if (min === dL || min === dR) { b.vx = -b.vx; b.x = min === dL ? w.x - BULLET_RADIUS - 1 : w.x + w.w + BULLET_RADIUS + 1; }
  else { b.vy = -b.vy; b.y = min === dT ? w.y - BULLET_RADIUS - 1 : w.y + w.h + BULLET_RADIUS + 1; }
}

function clamp(v: number, min: number, max: number): number { return Math.max(min, Math.min(max, v)); }
function shuffleArray<T>(arr: T[]): T[] { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

// ── Build client state ──
function buildGameState(game: ActiveGame): GameState {
  const players: PlayerState[] = [];
  for (const p of game.players.values()) {
    players.push({
      id: p.id, name: p.name, x: p.x, y: p.y,
      hp: p.hp, maxHp: p.maxHp, team: p.team, level: p.level,
      aimAngle: p.aimAngle, alive: p.alive, onBye: p.onBye,
      kills: p.kills, deaths: p.deaths,
      slowed: p.slowMultiplier < 1, damageDealt: Math.round(p.damageDealt), damageFlashMs: p.damageFlashMs,
      augments: p.augments, critChance: p.critChance, armor: p.armor, range: p.effectiveRange,
      burning: p.burnRemainingMs > 0, frozen: p.freezeRemainingMs > 0,
      shieldGuardReady: p.shieldGuardActive, playerRadius: p.playerRadius,
      stats: {
        health: p.effectiveMaxHp,
        attackDamage: Math.round(p.effectiveDamage * 10) / 10,
        attackSpeed: Math.round((1000 / p.effectiveShootCooldown) * 10) / 10,
        armor: p.armor, movementSpeed: Math.round(p.effectiveSpeed), range: p.effectiveRange,
      },
    });
  }

  const teams: TeamState[] = Array.from(game.teams.values()).map((t) => ({
    teamNumber: t.teamNumber, health: t.health, eliminated: t.eliminated,
    eliminationOrder: t.eliminationOrder, playerIds: t.playerIds,
    color: t.color, colorName: t.colorName,
  }));

  return {
    phase: "combat", roundNumber: game.roundNumber, currentLevel: game.currentLevel,
    players, bullets: game.bullets.map((b) => ({ id: b.id, ownerId: b.ownerId, x: b.x, y: b.y, vx: b.vx, vy: b.vy, damage: b.damage, bouncesRemaining: b.bouncesRemaining, piercing: b.piercing })),
    teams, matchups: game.matchups,
    killFeed: game.killFeed,
    walls: game.tickCounter <= 2 ? walls : [],
    mapWidth: MAP_WIDTH, mapHeight: MAP_HEIGHT,
    timeRemainingMs: game.roundTimeRemainingMs,
    roomCode: game.roomCode, gameMode: game.gameMode,
  };
}
