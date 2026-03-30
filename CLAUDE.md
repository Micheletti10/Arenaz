# Arenaz — 2D Top-Down Multiplayer Arena Game

## Stack

- Monorepo: `/client`, `/server`, `/packages/types`
- Client: Vite + Phaser 3 + TypeScript
- Server: Node.js + Socket.io + TypeScript
- **NO Redis.** All game state lives in a single in-memory object on the server.
- No database. No auth. No ORM.
- Shared types live in `/packages/types/src/index.ts` — always import from there, never redefine types locally.

## Architecture Rules

- The server is the **single source of truth**. Clients NEVER calculate game outcomes.
- Server runs a **60hz authoritative game loop**. It broadcasts game state to clients at 30hz (every 2nd tick).
- Clients send **input events only** (movement direction, aim angle, shoot). Server computes results.
- Clients render the received state directly — **no client-side prediction, no interpolation** (except remote player lerp at 0.3).
- All collision detection happens server-side.
- Walls are hard-coded rectangles in an array: `walls = [{x, y, w, h}, ...]`. No tilemaps.
- All augment effects are applied and tracked server-side only.

## Game Flow (LoL Arena-style)

1. **Lobby** → Host creates room (4-digit code), players join, host picks gamemode (FFA or Duo)
2. **Augment Draft** (25s) → 3 augment cards shown per player (unique per player), each picks 1, 2 rerolls per card
3. **Combat Round** (45s) → Teams paired via round-robin, fight 1v1. No respawn within round.
4. **Round Result** (5s) → Losing team takes HP damage. Teams at 0 HP eliminated.
5. Repeat steps 2-4 until **1 team remains** (max 20 rounds)
6. **Match Over** → Team placements shown (1st, 2nd, 3rd, etc.)

### Gamemodes

- **FFA Arena** (1v1v1v1v1v1): Up to 6 solo players, each is their own team with a unique color (Red, Blue, Green, Yellow, Purple, Orange).
- **Duo Arena** (2v2v2): 3 teams of 2 players. Colors: Red, Blue, Green.

### Round-Robin Matchmaking

- Each round, non-eliminated teams are paired for 1v1 combat.
- A team cannot fight the same opponent until all others have been fought.
- If odd number of teams, one team gets a bye (no fight, no HP loss).
- Teams on bye are invulnerable (`onBye: true`).
- When a matchup history is exhausted, it resets.

### Team Health System

- Each team starts with **100 HP**.
- Losing a combat round costs HP: 15 (rounds 1-3), 20 (4-6), 30 (7-9), 35 (10+).
- Teams at 0 HP are **eliminated**.
- Last team standing wins.

### Leveling System

- All players start at **level 1**.
- Gain **1 level per round** (level = round number, capped at 20).
- Each level increases: HP (+8), Damage (+1.0), Speed (+1.5).
- Base stats at level 1: HP 100, Speed 200, Damage 15.

### No Hero System

- There is **one default character** — no Bruiser/Phantom/Warden.
- No character selection in lobby.
- No character-specific abilities (bash, blink, grenade removed).
- All differentiation comes from augment choices.

### Augments (20 total)

**Silver (stackable stat boosts):**
1. Attack Boost (+15% damage)
2. Speed Boost (+15% movement speed, capped at 1.6x total)
3. HP Boost (+20% max HP)
4. Attack Speed Boost (+15% fire rate, floor 100ms cooldown)
5. Crit Chance (+10% chance for 1.5x damage, capped at 50%)
6. Armor (+15 flat armor per stack)
7. Range+ (+150px bullet range)

**Gold (non-stackable except Multishot):**
8. Multishot (+1 bullet per shot, stackable, -15% damage each)
9. Ricochet (bullets bounce to 1 nearby enemy, -30% damage)
10. Piercing Shot (bullets pass through first enemy, -33% after)
11. Bouncy Wall (bullets bounce off walls 2x, -50% damage per bounce)
12. Freeze (hits slow enemy 30% for 1.5s)
13. Blaze (hits burn: 15% base damage/s for 2s)
14. Extended Range (+400px range)

**Prismatic (non-stackable):**
15. Front Arrow (+1 forward bullet, ALL bullets -25% damage)
16. Side Arrows (+2 bullets at ±60°, -40% damage)
17. Death Nova (killed enemies explode into 6 projectiles)
18. Shield Guard (blocks 1 bullet every 8s)
19. Giant (+40% damage, +5% HP, 35% larger hitbox)
20. Sniper (infinite bullet range)

Tier is **random each round** (equal 33.3% chance for Silver/Gold/Prismatic).

### Draft System

- Each player sees **3 unique random cards** (different cards per player, same tier).
- Each card has **2 individual rerolls** (rerolling replaces that one card only).
- 25 second timer. Auto-picks random card if player doesn't choose.
- All players draft simultaneously between combat rounds.

## Socket.io Event Names

- **client → server**: `input`, `joinRoom`, `createRoom`, `selectGamemode`, `startGame`, `ready`, `selectAugment`, `rerollDraft`
- **server → client**: `gameState`, `roomState`, `draftState`, `roundResult`, `gameOver`, `playerJoined`, `playerLeft`, `error`

## Code Style

- TypeScript strict mode everywhere. No `any`.
- Interfaces over types for all game objects.
- All game constants go in `/packages/types/src/constants.ts` — never hardcode magic numbers inline.
- Functions over classes for game logic on the server.
- Keep socket event handlers thin — they call functions, they don't contain logic themselves.

## File Structure

```
/client
  /src
    /scenes       ← Phaser scenes (LobbyScene, GameScene, GameOverScene)
    network.ts    ← Socket.io client singleton
    main.ts       ← Phaser game bootstrap
/server
  /src
    /game         ← game loop, collision, augments, round management
    /rooms        ← room creation, player management
    index.ts      ← Socket.io setup, event routing, static file serving
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
- During draft: countdown timer, per-player card generation, selection handling, per-card reroll. Broadcasts `draftState` to each player individually.
- During combat: 60hz tick with movement, shooting, bullets, burn/freeze ticks, shield guard cooldowns. Broadcasts `gameState` at 30hz.
- During roundResult: 5s pause. Evaluates matchup winners, applies team HP damage, eliminates teams. Broadcasts `roundResult` once.
- `recalculatePlayerStats()` runs at start of each combat round — computes effective speed/damage/HP/cooldown/crit/radius from base level stats + all augments.
- Input is stored persistently with a staleness timeout (150ms). If no new input arrives, movement stops.
- No respawn within combat rounds — dead players stay dead until next round.

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
- Do not add client-side prediction for movement — server is the single source of truth.
- Do not add character/hero system back — the game uses a single default character.
- Do not add powerups that spawn on the map — augments are chosen via draft only.
- Do not add respawning within combat rounds — players stay dead until next round.
