// EMBERFALL entry program (Node 22, standard library only).
//
// What it does: takes the playable game from this repository's game/ folder
// and the screenshots from screenshots/, copies both into the output
// directory, and writes dossier.json there — the summary the make.fun judge
// reads — using the vendored buildDossier helper.
//
// Run it locally to check the entry before submitting:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Inside the grader the output directory is /output, so no variable is
// needed there. Serve the game itself with any static file server, e.g.
//   python3 -m http.server --directory game 8080
// and open http://localhost:8080 in desktop Chrome.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });

// The playable game: plain static files, loaded offline by game/index.html.
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });

// The screenshots: 3 or 4 real renders of the game, first by name is the cover.
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
const shotsDir = join(repoRoot, 'screenshots');
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });
}

// The dossier the judge reads, built from exactly what was copied above.
// Caps are the scorer's own limits for this competition.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
