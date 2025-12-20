# GameNSMirror (Farm Life prototype)

A small **Phaser 3 + TypeScript + Vite** web game prototype. Right now it’s a simple single-player scene flow:
- Boot → Title (pick gender + name) → Game (top-down movement on a basic map)
- If sprite/tile assets are missing, the game generates simple procedural fallback art.

## Run locally

### Prereqs
- Node.js (LTS recommended)
- npm

### Install & start
```bash
npm install
npm run dev
````

Vite will open the site (or show a local URL in the terminal).

### Build & preview

```bash
npm run build
npm run preview
```

## Controls

* Move: **WASD** or **Arrow Keys**

## Where the code lives

* `src/main.ts` — Phaser game config + scene list
* `src/scenes/BootScene.ts` — loading + procedural fallback textures + animations
* `src/scenes/TitleScene.ts` — character selection + name entry
* `src/scenes/GameScene.ts` — tilemap + player spawn + camera follow
* `src/entities/Player.ts` — movement + animation switching
* `src/config/constants.ts` — sizes, speeds, scene keys

## Assets (optional right now)

The boot scene attempts to load:

* `assets/sprites/player_male.png`
* `assets/sprites/player_female.png`
* `assets/tiles/tileset.png`

If those files aren’t present, it will still run using procedural textures.

## Roadmap / Endgame (high-level)

- [ ] **Maps / Areas (FC):** show different areas (cafe/lobby, coworking floors, 13th floor partial, gym) and move between them.
- [ ] **Backend + DB:** auth + user data (NS username, join date, sign-in provider) + profile metadata (links/about).
- [ ] **Avatars:** use a real sprite sheet (or existing one); for early MVP, assign a random avatar from a fixed set (no custom creator yet).
- [ ] **World interactions:** richer map with points/entries (Stardew / Pokémon vibe) using Phaser.
- [ ] **GPT NPCs:** scheduled NPC behavior (early MVP: scripted schedules + "seemingly random" movement). NPCs: balaji, jackson, yash, otavio.
- [ ] **Social UI:** users clickable → profile view; small header UI for a timeline of NS people; "bookface" directory-style view.

---