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
export const RESPAWN_DELAY_MS = 2000;
export const PLAYER_RADIUS = 16;

// ── Rounds ──
export const TOTAL_ROUNDS = 5;
export const COMBAT_DURATION_S = 75;
export const DRAFT_DURATION_MS = 25000;
export const ROUND_RESULT_DURATION_MS = 5000;
export const DRAFT_REROLLS_PER_CARD = 2;
export const DRAFT_CARDS_OFFERED = 3;

// ── Range & Armor ──
export const BASE_BULLET_RANGE = 400; // default max bullet travel distance in px
export const ARMOR_FORMULA_CONSTANT = 100; // LoL-style: reduction = armor / (armor + 100)

// ── Shooting ──
export const BULLET_SPEED = 600;
export const BULLET_RADIUS = 4;
export const SHOOT_COOLDOWN_MS = 300;

// ── Characters ──
export const BRUISER_HP = 150;
export const BRUISER_SPEED = 180;
export const BRUISER_DAMAGE = 18;
export const BRUISER_PASSIVE_THRESHOLD = 0.4;
export const BRUISER_PASSIVE_REDUCTION = 0.15;
export const BRUISER_BASH_COOLDOWN_MS = 6000;
export const BRUISER_BASH_RANGE = 80;
export const BRUISER_BASH_KNOCKBACK = 400;

export const PHANTOM_HP = 90;
export const PHANTOM_SPEED = 250;
export const PHANTOM_DAMAGE = 24;
export const PHANTOM_BLINK_BONUS = 0.5;
export const PHANTOM_BLINK_COOLDOWN_MS = 5000;
export const PHANTOM_BLINK_DISTANCE = 150;

export const WARDEN_HP = 120;
export const WARDEN_SPEED = 190;
export const WARDEN_DAMAGE = 20;
export const WARDEN_HEAL_RATE = 2;
export const WARDEN_HEAL_DELAY_MS = 3000;
export const WARDEN_GRENADE_COOLDOWN_MS = 8000;
export const WARDEN_GRENADE_RADIUS = 100;
export const WARDEN_GRENADE_DURATION_MS = 3000;
export const WARDEN_GRENADE_SLOW = 0.5;
export const WARDEN_GRENADE_RANGE = 250;

// ── Kill Feed ──
export const KILL_FEED_MAX = 5;
export const KILL_FEED_DURATION_MS = 5000;

// ══════════════════════════════════
// ── Augment Values ──
// ══════════════════════════════════

// Silver (stackable)
export const AUG_ATTACK_BOOST = 0.15;
export const AUG_SPEED_BOOST = 0.15;
export const AUG_SPEED_CAP = 1.6; // max total speed multiplier
export const AUG_HP_BOOST = 0.20;
export const AUG_ATTACK_SPEED_BOOST = 0.15;
export const AUG_ATTACK_SPEED_FLOOR_MS = 100; // min shoot cooldown
export const AUG_CRIT_CHANCE = 0.10;
export const AUG_CRIT_MULTIPLIER = 1.5;
export const AUG_CRIT_CAP = 0.50;

// Gold (non-stackable)
export const AUG_MULTISHOT_SPREAD = 0.12; // radians between bullets
export const AUG_MULTISHOT_DAMAGE_PENALTY = 0.15; // each bullet does 85%

export const AUG_RICOCHET_TARGETS = 1;
export const AUG_RICOCHET_DAMAGE_PENALTY = 0.30; // ricochet does 70%
export const AUG_RICOCHET_RANGE = 200;

export const AUG_PIERCING_DAMAGE_PENALTY = 0.33; // 67% after pierce

export const AUG_BOUNCY_WALL_BOUNCES = 2;
export const AUG_BOUNCY_WALL_DAMAGE_PENALTY = 0.50; // 50% after bounce

export const AUG_FREEZE_SLOW = 0.30; // 30% slow
export const AUG_FREEZE_DURATION_MS = 1500;

export const AUG_BLAZE_DPS_PERCENT = 0.15; // 15% base damage/s
export const AUG_BLAZE_DURATION_MS = 2000;

// Prismatic (non-stackable)
export const AUG_FRONT_ARROW_DAMAGE_PENALTY = 0.25; // all bullets -25%

export const AUG_SIDE_ARROWS_ANGLE = Math.PI / 3; // 60 degrees
export const AUG_SIDE_ARROWS_DAMAGE_PENALTY = 0.40; // side bullets 60%

export const AUG_DEATH_NOVA_PROJECTILES = 6;
export const AUG_DEATH_NOVA_DAMAGE_PERCENT = 0.20;

export const AUG_SHIELD_GUARD_COOLDOWN_MS = 8000;

export const AUG_GIANT_DAMAGE_BOOST = 0.40;
export const AUG_GIANT_HP_BOOST = 0.05;
export const AUG_GIANT_RADIUS_MULTIPLIER = 1.35;

// Armor augment
export const AUG_ARMOR_BOOST = 15; // flat armor per stack

// Range augments
export const AUG_RANGE_BOOST_SMALL = 150; // +150px range per stack
export const AUG_RANGE_BOOST_MEDIUM = 400; // +400px (Gold)
export const AUG_SNIPER_RANGE = 0; // 0 = infinite range

// Multishot stacking
export const AUG_MULTISHOT_SPREAD_BASE = 0.15; // radians spread per multishot level
