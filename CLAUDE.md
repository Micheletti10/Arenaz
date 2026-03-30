# Arenaz — 2D Top-Down Multiplayer Browser Arena Game

## Stack

- Monorepo: `/client`, `/server`, `/packages/types`
- Client: Vite + Phaser 3 + TypeScript
- Server: Node.js + Socket.io + TypeScript
- **NO Redis.** All game state lives in a single in-memory object on the server.
- No database. No auth. No ORM.
- Shared types live in `/packages/types/src/index.ts` — always import from there, never redefine types locally.

## Architecture Rules

- The server is the **single source of truth**. Clients NEVER calculate game outcomes.
- Server runs a **60hz authoritative game loop**. It broadcasts full game state to all clients every tick.
- Clients send **input events only** (movement direction, aim angle, shoot, ability). Server computes results.
- Clients render the received state directly — **no client-side prediction, no interpolation**.
- All collision detection happens server-side.
- Walls are hard-coded rectangles in an array: `walls = [{x, y, w, h}, ...]`. No tilemaps.
- All augment effects are applied and tracked server-side only.

## Game Flow

1. **Lobby** → Host creates room (4-digit code), players join, select characters, host picks gamemode
2. **Augment Draft** (18s) → 3 augment cards shown, each player picks 1, 2 rerolls available
3. **Combat Round** (75s) → Arena fight with all current augments active
4. **Round Result** (5s) → Kills this round + cumulative shown
5. Repeat steps 2-4 for **5 rounds total**
6. **Match Over** → Cumulative kills across all rounds determines winner

### Round Tier Schedule

- Round 1-2: **Silver** augments (stat boosts, stackable)
- Round 3-4: **Gold** augments (mechanical changes, non-stackable)
- Round 5: **Prismatic** augments (game-changing, non-stackable)

All players see the same tier each round for fairness.

## Game Systems

### Gamemodes

- **Deathmatch**: FFA, most cumulative kills across 5 rounds wins.
- **TeamDeathmatch**: Red vs Blue, respawn on death, most team kills after 5 rounds.

### Characters (3 total)

- **Bruiser**: High HP (150), medium speed (180), medium damage (18). Active: Shield Bash (knockback). Passive: 15% damage reduction below 40% HP.
- **Phantom**: Low HP (90), high speed (250), high damage (24). Active: Blink (teleport in movement direction). Passive: +50% damage on first shot after Blink.
- **Warden**: Medium HP (120), medium speed (190), medium damage (20). Active: Pulse Grenade (AoE slow). Passive: 2 HP/s self-heal after 3s without taking damage.

### Augments (16 total, replace old powerup system)

**Silver (stackable stat boosts):**
1. Attack Boost (+15% damage)
2. Speed Boost (+15% movement speed, capped at 1.6x total)
3. HP Boost (+20% max HP, heals to new max)
4. Attack Speed Boost (+15% fire rate, floor 100ms cooldown)
5. Crit Chance (+10% chance for 1.5x damage, capped at 50%)

**Gold (mechanical, non-stackable):**
6. Multishot (2 bullets per shot, -15% damage each, spread angle)
7. Ricochet (bullets bounce to 1 nearby enemy on hit, -30% ricochet damage, 200px range)
8. Piercing Shot (bullets pass through first enemy, -33% damage after pierce)
9. Bouncy Wall (bullets bounce off walls 2x, -50% damage after each bounce)
10. Freeze (hits slow enemy by 30% for 1.5s)
11. Blaze (hits apply burn: 15% base damage/s for 2s)

**Prismatic (game-changing, non-stackable):**
12. Front Arrow (+1 extra bullet forward, ALL bullets -25% damage)
13. Side Arrows (+2 bullets at ±60° angles, -40% damage on side bullets)
14. Death Nova (killed enemies explode into 6 projectiles, 20% damage each)
15. Shield Guard (orbiting shield blocks 1 bullet every 8s)
16. Giant (+40% damage, +5% HP, 35% larger hitbox)

### Augment Combos

- FrontArrow + Multishot = 4 forward bullets
- BouncyWall + Ricochet = bounce off walls AND between enemies
- Blaze + Freeze = slow AND burn simultaneously
- DeathNova can chain-kill (nova projectiles can trigger more novas)

## Socket.io Event Names

Always use these exact event names — never rename them:

- **client → server**: `input`, `joinRoom`, `createRoom`, `selectCharacter`, `selectGamemode`, `startGame`, `ready`, `selectAugment`, `rerollDraft`
- **server → client**: `gameState`, `roomState`, `draftState`, `roundResult`, `gameOver`, `playerJoined`, `playerLeft`, `error`

## Code Style

- TypeScript strict mode everywhere. No `any`.
- Interfaces over types for all game objects.
- All game constants (speeds, HP values, cooldowns, augment values) go in `/packages/types/src/constants.ts` — never hardcode magic numbers inline.
- Functions over classes for game logic on the server (easier to test and reason about).
- Keep socket event handlers thin — they call functions, they don't contain logic themselves.

## File Structure

```
/client
  /src
    /scenes       ← Phaser scenes (LobbyScene, GameScene, GameOverScene)
    /components   ← HUD, character select UI
    /game         ← client-side rendering helpers
    network.ts    ← Socket.io client singleton
    main.ts       ← Phaser game bootstrap
/server
  /src
    /game         ← game loop, collision, characters, augments, round management
    /rooms        ← room creation, player management
    index.ts      ← Socket.io setup, event routing
/packages
  /types
    /src
      index.ts      ← all shared interfaces
      constants.ts  ← all numeric game constants
```

## Learned — Movement System Rules (do not change)

- Client sends **pure integer dx/dy** (-1, 0, or 1) from WASD keys only. `aimAngle` is NEVER part of dx/dy.
- Server normalizes diagonal input: `len = Math.sqrt(dx*dx + dy*dy)`, `ndx = dx/len`, `ndy = dy/len`.
- Server applies movement as: `player.x += ndx * speed * dt`, `player.y += ndy * speed * dt`. No `Math.cos`/`Math.sin` on the movement vector. No rotation of any kind.
- **Wall collision must always be axis-separated**: move X first, check collision, revert X if hit. Then move Y, check collision, revert Y if hit. Never resolve both axes in the same collision check.
- `aimAngle` is only used for shooting direction and visual aim indicator — it must never affect movement velocity.

## Learned — Server Game Loop Architecture

- The main `tick()` function routes by `game.phase`: `draft` → `combat` → `roundResult` → back to `draft` (or `matchOver`)
- During draft: countdown timer, card generation, selection handling, reroll. Broadcasts `draftState`.
- During combat: 60hz tick with movement, shooting, bullets, abilities, burn/freeze ticks, shield guard cooldowns. Broadcasts `gameState`.
- During roundResult: 5s pause, broadcasts `roundResult` once.
- `recalculatePlayerStats()` runs at start of each combat round — computes effective speed/damage/HP/cooldown/crit/radius from base stats + all augments.
- Input is stored persistently with a staleness timeout (150ms). If no new input arrives, movement stops.

## Learned — HUD Architecture

- GameScene uses a **separate Phaser camera** (`hudCamera`) at zoom=1 for all HUD elements.
- Main camera has zoom for the world, HUD camera renders at native screen resolution.
- All HUD objects use `cameras.main.ignore()` to avoid being affected by world zoom.
- Draft overlay and round result overlay are also on the HUD camera layer.

## What NOT To Do

- Do not add Redis, databases, or any persistence layer.
- Do not add client-side physics or collision.
- Do not add authentication or user accounts.
- Do not use tilemaps — walls are rectangles only.
- Do not add client-side interpolation — render received state directly.
- Do not split game logic across multiple files unnecessarily — keep it readable.
- Do not add powerups that spawn on the map — the old powerup system has been replaced by augments.
- Do not add client-side prediction for movement — server is the single source of truth.
