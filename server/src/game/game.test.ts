import { describe, it, expect } from "vitest";
import {
  getStatsForLevel,
  createPlayer,
  recalculatePlayerStats,
  hasAugment,
  countAugment,
  circleCollidesWalls,
  getCollidingWall,
  bounceBullet,
  clamp,
} from "./game.js";
import type { InternalPlayer } from "./game.js";
import {
  BASE_PLAYER_HP, BASE_PLAYER_SPEED, BASE_PLAYER_DAMAGE,
  HP_PER_LEVEL, DAMAGE_PER_LEVEL, SPEED_PER_LEVEL, MAX_LEVEL,
  PLAYER_RADIUS, SHOOT_COOLDOWN_MS, BASE_BULLET_RANGE, BULLET_SPEED,
  AUG_ATTACK_BOOST, AUG_SPEED_BOOST, AUG_SPEED_CAP,
  AUG_HP_BOOST, AUG_ATTACK_SPEED_BOOST, AUG_ATTACK_SPEED_FLOOR_MS,
  AUG_CRIT_CHANCE, AUG_CRIT_CAP, AUG_ARMOR_BOOST,
  AUG_RANGE_BOOST_SMALL, AUG_RANGE_BOOST_MEDIUM,
  AUG_GIANT_DAMAGE_BOOST, AUG_GIANT_HP_BOOST, AUG_GIANT_RADIUS_MULTIPLIER,
  AUG_MULTISHOT_ATTACK_SPEED_PENALTY,
  AUG_LIFESTEAL_SMALL, AUG_LIFESTEAL_LARGE,
  AUG_BULLET_SPEED_SMALL, AUG_BULLET_SPEED_LARGE,
  AUG_CELESTIAL_HP_BOOST, AUG_CELESTIAL_DMG_PENALTY,
  AUG_FAN_RANGE_PENALTY,
  ARENA_CENTER_X, ARENA_CENTER_Y, ARENA_RADIUS,
} from "@arenaz/types/src/constants.js";

function makePlayer(overrides?: Partial<InternalPlayer>): InternalPlayer {
  const stats = getStatsForLevel(1);
  const base = createPlayer("test", "Test", 400, 300, 1, stats);
  return { ...base, ...overrides };
}

// ══════════════════════════════════
// ── getStatsForLevel ──
// ══════════════════════════════════
describe("getStatsForLevel", () => {
  it("returns base stats at level 1", () => {
    const s = getStatsForLevel(1);
    expect(s.hp).toBe(BASE_PLAYER_HP);
    expect(s.speed).toBe(BASE_PLAYER_SPEED);
    expect(s.damage).toBe(BASE_PLAYER_DAMAGE);
  });

  it("scales linearly with level", () => {
    const s = getStatsForLevel(5);
    expect(s.hp).toBe(BASE_PLAYER_HP + HP_PER_LEVEL * 4);
    expect(s.speed).toBe(BASE_PLAYER_SPEED + SPEED_PER_LEVEL * 4);
    expect(s.damage).toBe(BASE_PLAYER_DAMAGE + DAMAGE_PER_LEVEL * 4);
  });

  it("caps at MAX_LEVEL", () => {
    const atMax = getStatsForLevel(MAX_LEVEL);
    const beyond = getStatsForLevel(MAX_LEVEL + 10);
    expect(beyond.hp).toBe(atMax.hp);
    expect(beyond.speed).toBe(atMax.speed);
    expect(beyond.damage).toBe(atMax.damage);
  });

  it("returns correct stats at level 20 (max)", () => {
    const s = getStatsForLevel(20);
    expect(s.hp).toBe(BASE_PLAYER_HP + HP_PER_LEVEL * 19);
    expect(s.speed).toBe(BASE_PLAYER_SPEED + SPEED_PER_LEVEL * 19);
    expect(s.damage).toBe(BASE_PLAYER_DAMAGE + DAMAGE_PER_LEVEL * 19);
  });
});

// ══════════════════════════════════
// ── hasAugment / countAugment ──
// ══════════════════════════════════
describe("augment helpers", () => {
  it("hasAugment returns true when augment is present", () => {
    expect(hasAugment({ augments: ["AttackBoost", "Freeze"] }, "Freeze")).toBe(true);
  });

  it("hasAugment returns false when augment is absent", () => {
    expect(hasAugment({ augments: ["AttackBoost"] }, "Freeze")).toBe(false);
  });

  it("countAugment counts stacked augments", () => {
    expect(countAugment({ augments: ["AttackBoost", "AttackBoost", "Freeze"] }, "AttackBoost")).toBe(2);
  });

  it("countAugment returns 0 when absent", () => {
    expect(countAugment({ augments: [] }, "AttackBoost")).toBe(0);
  });
});

// ══════════════════════════════════
// ── recalculatePlayerStats ──
// ══════════════════════════════════
describe("recalculatePlayerStats", () => {
  it("base stats with no augments at level 1", () => {
    const p = makePlayer();
    recalculatePlayerStats(p);
    expect(p.effectiveSpeed).toBe(BASE_PLAYER_SPEED);
    expect(p.effectiveDamage).toBe(BASE_PLAYER_DAMAGE);
    expect(p.effectiveMaxHp).toBe(BASE_PLAYER_HP);
    expect(p.effectiveShootCooldown).toBe(SHOOT_COOLDOWN_MS);
    expect(p.critChance).toBe(0);
    expect(p.armor).toBe(0);
    expect(p.effectiveRange).toBe(BASE_BULLET_RANGE);
    expect(p.playerRadius).toBe(PLAYER_RADIUS);
    expect(p.lifestealPercent).toBe(0);
    expect(p.effectiveBulletSpeed).toBe(BULLET_SPEED);
  });

  it("AttackBoost stacks additively", () => {
    const p = makePlayer({ augments: ["AttackBoost", "AttackBoost"] });
    recalculatePlayerStats(p);
    expect(p.effectiveDamage).toBeCloseTo(BASE_PLAYER_DAMAGE * (1 + AUG_ATTACK_BOOST * 2));
  });

  it("SpeedBoost caps at AUG_SPEED_CAP", () => {
    // 5 speed boosts = 1 + 0.15*5 = 1.75, should cap at 1.6
    const p = makePlayer({ augments: ["SpeedBoost", "SpeedBoost", "SpeedBoost", "SpeedBoost", "SpeedBoost"] });
    recalculatePlayerStats(p);
    expect(p.effectiveSpeed).toBe(BASE_PLAYER_SPEED * AUG_SPEED_CAP);
  });

  it("HpBoost increases max HP", () => {
    const p = makePlayer({ augments: ["HpBoost"] });
    recalculatePlayerStats(p);
    expect(p.effectiveMaxHp).toBe(Math.round(BASE_PLAYER_HP * (1 + AUG_HP_BOOST)));
    expect(p.hp).toBe(p.effectiveMaxHp); // HP reset to max
  });

  it("AttackSpeedBoost reduces shoot cooldown", () => {
    const p = makePlayer({ augments: ["AttackSpeedBoost"] });
    recalculatePlayerStats(p);
    expect(p.effectiveShootCooldown).toBe(SHOOT_COOLDOWN_MS / (1 + AUG_ATTACK_SPEED_BOOST));
  });

  it("AttackSpeedBoost respects floor", () => {
    // Stack enough AS boosts so cooldown would go below 100ms floor
    // 600 / (1 + 0.15*40) = 600/7 = ~85ms → should clamp to 100ms
    const augments = Array(40).fill("AttackSpeedBoost") as InternalPlayer["augments"];
    const p = makePlayer({ augments });
    recalculatePlayerStats(p);
    expect(p.effectiveShootCooldown).toBe(AUG_ATTACK_SPEED_FLOOR_MS);
  });

  it("CritChance caps at AUG_CRIT_CAP", () => {
    const augments = Array(10).fill("CritChance") as InternalPlayer["augments"];
    const p = makePlayer({ augments });
    recalculatePlayerStats(p);
    expect(p.critChance).toBe(AUG_CRIT_CAP);
  });

  it("ArmorBoost stacks", () => {
    const p = makePlayer({ augments: ["ArmorBoost", "ArmorBoost"] });
    recalculatePlayerStats(p);
    expect(p.armor).toBe(AUG_ARMOR_BOOST * 2);
  });

  it("RangeBoostSmall adds range", () => {
    const p = makePlayer({ augments: ["RangeBoostSmall"] });
    recalculatePlayerStats(p);
    expect(p.effectiveRange).toBe(BASE_BULLET_RANGE + AUG_RANGE_BOOST_SMALL);
  });

  it("RangeBoostMedium adds range", () => {
    const p = makePlayer({ augments: ["RangeBoostMedium"] });
    recalculatePlayerStats(p);
    expect(p.effectiveRange).toBe(BASE_BULLET_RANGE + AUG_RANGE_BOOST_MEDIUM);
  });

  it("Sniper gives infinite range (0)", () => {
    const p = makePlayer({ augments: ["Sniper"] });
    recalculatePlayerStats(p);
    expect(p.effectiveRange).toBe(0);
  });

  it("Giant increases damage, HP, and hitbox radius", () => {
    const p = makePlayer({ augments: ["Giant"] });
    recalculatePlayerStats(p);
    expect(p.effectiveDamage).toBeCloseTo(BASE_PLAYER_DAMAGE * (1 + AUG_GIANT_DAMAGE_BOOST));
    expect(p.effectiveMaxHp).toBe(Math.round(BASE_PLAYER_HP * (1 + AUG_GIANT_HP_BOOST)));
    expect(p.playerRadius).toBe(Math.round(PLAYER_RADIUS * AUG_GIANT_RADIUS_MULTIPLIER));
  });

  it("Lifesteal augments stack", () => {
    const p = makePlayer({ augments: ["LifestealSmall", "LifestealLarge"] });
    recalculatePlayerStats(p);
    expect(p.lifestealPercent).toBeCloseTo(AUG_LIFESTEAL_SMALL + AUG_LIFESTEAL_LARGE);
  });

  it("BulletSpeed augments stack", () => {
    const p = makePlayer({ augments: ["BulletSpeedSmall", "BulletSpeedLarge"] });
    recalculatePlayerStats(p);
    expect(p.effectiveBulletSpeed).toBeCloseTo(BULLET_SPEED * (1 + AUG_BULLET_SPEED_SMALL + AUG_BULLET_SPEED_LARGE));
  });

  it("CelestialBody: +HP, -damage", () => {
    const p = makePlayer({ augments: ["CelestialBody"] });
    recalculatePlayerStats(p);
    expect(p.effectiveMaxHp).toBe(Math.round(BASE_PLAYER_HP * (1 + AUG_CELESTIAL_HP_BOOST)));
    expect(p.effectiveDamage).toBeCloseTo(BASE_PLAYER_DAMAGE * (1 - AUG_CELESTIAL_DMG_PENALTY));
  });

  it("FanTheHammer reduces range", () => {
    const p = makePlayer({ augments: ["FanTheHammer"] });
    recalculatePlayerStats(p);
    expect(p.effectiveRange).toBeCloseTo(BASE_BULLET_RANGE * (1 - AUG_FAN_RANGE_PENALTY));
  });

  it("Multishot penalty on attack speed", () => {
    const p = makePlayer({ augments: ["Multishot", "Multishot"] });
    recalculatePlayerStats(p);
    const msPenalty = 1 + 2 * AUG_MULTISHOT_ATTACK_SPEED_PENALTY;
    expect(p.effectiveShootCooldown).toBeCloseTo(SHOOT_COOLDOWN_MS * msPenalty);
  });

  it("ShieldGuard activates on recalculate", () => {
    const p = makePlayer({ augments: ["ShieldGuard"] });
    recalculatePlayerStats(p);
    expect(p.shieldGuardActive).toBe(true);
    expect(p.shieldGuardCooldownMs).toBe(0);
  });

  it("combined augments: AttackBoost + Giant + CelestialBody", () => {
    const p = makePlayer({ augments: ["AttackBoost", "Giant", "CelestialBody"] });
    recalculatePlayerStats(p);
    const expectedDmgMul = 1 + AUG_ATTACK_BOOST + AUG_GIANT_DAMAGE_BOOST - AUG_CELESTIAL_DMG_PENALTY;
    expect(p.effectiveDamage).toBeCloseTo(BASE_PLAYER_DAMAGE * expectedDmgMul);
    const expectedHpMul = 1 + AUG_GIANT_HP_BOOST + AUG_CELESTIAL_HP_BOOST;
    expect(p.effectiveMaxHp).toBe(Math.round(BASE_PLAYER_HP * expectedHpMul));
  });

  it("higher level base stats are used", () => {
    const stats10 = getStatsForLevel(10);
    const p = makePlayer({ level: 10, baseSpeed: stats10.speed, baseDamage: stats10.damage });
    recalculatePlayerStats(p);
    expect(p.effectiveSpeed).toBe(stats10.speed);
    expect(p.effectiveDamage).toBe(stats10.damage);
    expect(p.effectiveMaxHp).toBe(stats10.hp);
  });
});

// ══════════════════════════════════
// ── Collision ──
// ══════════════════════════════════
describe("collision", () => {
  describe("circleCollidesWalls", () => {
    it("returns true when outside arena boundary", () => {
      // Well outside the arena
      expect(circleCollidesWalls(0, 0, PLAYER_RADIUS)).toBe(true);
    });

    it("returns false for arena center", () => {
      expect(circleCollidesWalls(ARENA_CENTER_X, ARENA_CENTER_Y, PLAYER_RADIUS)).toBe(false);
    });

    it("returns true at arena edge", () => {
      // Right at the boundary edge (outside)
      expect(circleCollidesWalls(ARENA_CENTER_X + ARENA_RADIUS, ARENA_CENTER_Y, PLAYER_RADIUS)).toBe(true);
    });

    it("returns false just inside arena edge", () => {
      const safeX = ARENA_CENTER_X + ARENA_RADIUS - PLAYER_RADIUS - 10;
      expect(circleCollidesWalls(safeX, ARENA_CENTER_Y, PLAYER_RADIUS)).toBe(false);
    });
  });

  describe("getCollidingWall", () => {
    it("returns null in open space", () => {
      expect(getCollidingWall(ARENA_CENTER_X, ARENA_CENTER_Y, PLAYER_RADIUS)).toBeNull();
    });

    it("detects collision with a pillar", () => {
      // First pillar is at (ARENA_CENTER_X - 250, ARENA_CENTER_Y - 200, 50, 50)
      const pillarCenterX = ARENA_CENTER_X - 250 + 25;
      const pillarCenterY = ARENA_CENTER_Y - 200 + 25;
      const wall = getCollidingWall(pillarCenterX, pillarCenterY, PLAYER_RADIUS);
      expect(wall).not.toBeNull();
    });
  });

  describe("bounceBullet", () => {
    it("reverses vx when hitting left/right wall face", () => {
      const wall = { x: 100, y: 100, w: 50, h: 50 };
      const bullet = {
        id: "b1", ownerId: "p1",
        x: 98, y: 125, // just left of wall
        vx: 100, vy: 0,
        damage: 10, bouncesRemaining: 1, piercing: false,
        distanceTraveled: 0, maxRange: 999,
      };
      bounceBullet(bullet, wall);
      expect(bullet.vx).toBe(-100);
    });

    it("reverses vy when hitting top/bottom wall face", () => {
      const wall = { x: 100, y: 100, w: 50, h: 50 };
      const bullet = {
        id: "b1", ownerId: "p1",
        x: 125, y: 98, // just above wall
        vx: 0, vy: 100,
        damage: 10, bouncesRemaining: 1, piercing: false,
        distanceTraveled: 0, maxRange: 999,
      };
      bounceBullet(bullet, wall);
      expect(bullet.vy).toBe(-100);
    });
  });
});

// ══════════════════════════════════
// ── clamp ──
// ══════════════════════════════════
describe("clamp", () => {
  it("returns value when within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("clamps to min", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it("clamps to max", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("handles equal min/max", () => {
    expect(clamp(5, 3, 3)).toBe(3);
  });
});

// ══════════════════════════════════
// ── createPlayer ──
// ══════════════════════════════════
describe("createPlayer", () => {
  it("initializes all fields correctly", () => {
    const stats = getStatsForLevel(1);
    const p = createPlayer("p1", "Alice", 100, 200, 2, stats);
    expect(p.id).toBe("p1");
    expect(p.name).toBe("Alice");
    expect(p.x).toBe(100);
    expect(p.y).toBe(200);
    expect(p.team).toBe(2);
    expect(p.hp).toBe(stats.hp);
    expect(p.maxHp).toBe(stats.hp);
    expect(p.alive).toBe(true);
    expect(p.kills).toBe(0);
    expect(p.deaths).toBe(0);
    expect(p.augments).toEqual([]);
    expect(p.shieldGuardActive).toBe(false);
    expect(p.freezeRemainingMs).toBe(0);
    expect(p.burnRemainingMs).toBe(0);
  });
});
