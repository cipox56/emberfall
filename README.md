# EMBERFALL

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/cipox56/emberfall/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/cipox56/emberfall/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

EMBERFALL is a top-down arena survival shooter that runs offline in a desktop browser from static files. You are the last Ember Warden, holding a burning arena against waves of cinder-fiends. Survive all 10 waves to win — or fall, and try again with a better build.

## How it plays

- **Move** with WASD or arrow keys, **aim** with the mouse, **hold click** to fire. **Space** dashes through danger, **P** pauses, **M** mutes.
- Enemies come in waves: slow Cinders that chase, Sparks that shoot back, heavy Brutes, and fast Darters that lunge. Each wave is bigger and meaner than the last.
- Between waves, pick 1 of 3 ember upgrades — more damage, faster fire, multi-shot, piercing rounds, extra health, speed, a magnet for pickups, or a quicker dash. Your choices shape the run.
- Health, shield and spread-shot pickups drop from fallen fiends. Score, wave, health and best score are always on the HUD.
- **Win** by clearing wave 10. **Lose** when your health reaches zero. Every run ends on a results screen with your score, wave reached, kills and time — and a restart.

## Run it

Serve `game/` with any static file server and open it in desktop Chrome:

```sh
python3 -m http.server --directory game 8080
# open http://localhost:8080
```

No build step, no network requests: every file the game loads lives under `game/`, and its sounds are synthesized live with WebAudio.

## Enter it

`main.ts` (Node 22, standard library only) hands the entry in: it copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
