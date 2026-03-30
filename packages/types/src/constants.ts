// ── Lobby ──
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
export const ROOM_CODE_LENGTH = 4;

// ── Map ──
export const MAP_WIDTH = 1600;
export const MAP_HEIGHT = 1200;
export const WALL_THICKNESS = 20;

// ── Game ──
export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;
export const PLAYER_RADIUS = 16;

// ── Rounds ──
export const MAX_ROUNDS = 20;
export const COMBAT_DURATION_S = 45;
export const DRAFT_DURATION_MS = 25000;
export const ROUND_RESULT_DURATION_MS = 5000;
export const DRAFT_REROLLS_PER_CARD = 2;
export const DRAFT_CARDS_OFFERED = 3;

// ── Single Character Base Stats ──
export const BASE_PLAYER_HP = 100;
export const BASE_PLAYER_SPEED = 200;
export const BASE_PLAYER_DAMAGE = 15;

// ── Leveling ──
export const MAX_LEVEL = 20;
export const HP_PER_LEVEL = 8;
export const DAMAGE_PER_LEVEL = 1.0;
export const SPEED_PER_LEVEL = 1.5;

// ── Team Health ──
export const TEAM_HEALTH_START = 100;
// Damage taken per loss, indexed by round number (0-based)
export const TEAM_DAMAGE_SCHEDULE = [
  15, 15, 15,       // Rounds 1-3
  20, 20, 20,       // Rounds 4-6
  30, 30, 30,       // Rounds 7-9
  35, 35, 35, 35, 35, 35, 35, 35, 35, 35, 35, // Rounds 10-20
];

// ── Team Colors ──
export const FFA_TEAM_COLORS = [0xff4444, 0x4488ff, 0x44cc44, 0xffcc00, 0xaa44ff, 0xff8800];
export const FFA_TEAM_COLOR_NAMES = ["Red", "Blue", "Green", "Yellow", "Purple", "Orange"];
export const DUO_TEAM_COLORS = [0xff4444, 0x4488ff, 0x44cc44];
export const DUO_TEAM_COLOR_NAMES = ["Red", "Blue", "Green"];

// ── Circular Arena ──
export const ARENA_CENTER_X = 800;
export const ARENA_CENTER_Y = 600;
export const ARENA_RADIUS = 520;

// ── Heal Orbs ──
export const HEAL_ORB_SMALL_AMOUNT = 25;
export const HEAL_ORB_LARGE_AMOUNT = 50;
export const HEAL_ORB_RESPAWN_MS = 15000;
export const HEAL_ORB_PICKUP_RADIUS = 20;

// ── Shooting ──
export const BULLET_SPEED = 600;
export const BULLET_RADIUS = 4;
export const SHOOT_COOLDOWN_MS = 150;
export const BASE_BULLET_RANGE = 400;
export const ARMOR_FORMULA_CONSTANT = 100;

// ── Kill Feed ──
export const KILL_FEED_MAX = 5;
export const KILL_FEED_DURATION_MS = 5000;

// ══════════════════════════════════
// ── Augment Values ──
// ══════════════════════════════════

// Silver (stackable)
export const AUG_ATTACK_BOOST = 0.15;
export const AUG_SPEED_BOOST = 0.15;
export const AUG_SPEED_CAP = 1.6;
export const AUG_HP_BOOST = 0.20;
export const AUG_ATTACK_SPEED_BOOST = 0.15;
export const AUG_ATTACK_SPEED_FLOOR_MS = 100;
export const AUG_CRIT_CHANCE = 0.10;
export const AUG_CRIT_MULTIPLIER = 1.5;
export const AUG_CRIT_CAP = 0.50;
export const AUG_ARMOR_BOOST = 15;
export const AUG_RANGE_BOOST_SMALL = 150;

// Gold (non-stackable)
export const AUG_MULTISHOT_SPREAD = 0.12;
export const AUG_MULTISHOT_DAMAGE_PENALTY = 0.15;
export const AUG_MULTISHOT_SPREAD_BASE = 0.15;
export const AUG_BOUNCY_WALL_BOUNCES = 2;
export const AUG_BOUNCY_WALL_DAMAGE_PENALTY = 0.50;
export const AUG_FREEZE_SLOW = 0.30;
export const AUG_FREEZE_DURATION_MS = 1500;
export const AUG_BLAZE_DPS_PERCENT = 0.15;
export const AUG_BLAZE_DURATION_MS = 2000;
export const AUG_RANGE_BOOST_MEDIUM = 400;

// Prismatic (non-stackable)
export const AUG_FRONT_ARROW_DAMAGE_PENALTY = 0.25;
export const AUG_SHIELD_GUARD_COOLDOWN_MS = 8000;
export const AUG_GIANT_DAMAGE_BOOST = 0.40;
export const AUG_GIANT_HP_BOOST = 0.05;
export const AUG_GIANT_RADIUS_MULTIPLIER = 1.35;
export const AUG_SNIPER_RANGE = 0;

// Lifesteal (% of damage dealt healed back)
export const AUG_LIFESTEAL_SMALL = 0.10;   // Silver: 10%
export const AUG_LIFESTEAL_MEDIUM = 0.25;  // Gold: 25%
export const AUG_LIFESTEAL_LARGE = 0.40;   // Prismatic: 40%

// Bullet Speed (multiplier on BULLET_SPEED)
export const AUG_BULLET_SPEED_SMALL = 0.15;   // Silver: +15%
export const AUG_BULLET_SPEED_MEDIUM = 0.35;  // Gold: +35%
export const AUG_BULLET_SPEED_LARGE = 0.60;   // Prismatic: +60%
