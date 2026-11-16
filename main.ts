// STARFORGE DEFENSE v3 — the entrypoint handed to make.fun (Node 22,
// standard library only). It copies this repository's game/ and
// screenshots/ into the output directory and writes dossier.json with the
// vendored make.fun library, under the scorer's caps from the kit.
//
// v3 is the 3D rebuild: the forge is now a real three.js scene — a metal
// deck floating in deep space, a captured living star whose light powers
// every tower along the molten conduit, and void constructs riding that
// conduit inward to drink the star dry. Fifty designed stages, a stage-
// reward choice after every assault, NEW HOSTILE intel cards as new
// constructs debut, level-3 tower specializations, STARFALL — the star
// hurling its own fire — and an endless mode beyond the final victory.
// Three.js is vendored as game/vendor/three.module.min.js (excluded from
// the source cap and the authorship count, per the kit's rules).
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// Caps the scorer enforces: dossier text at most 160 KiB (the vendored
// three.module.min.js is listed by path and bytes only, never as text),
// at most 4 screenshots of at most 256 KiB each, game/ at most 993 files
// and 48 MiB, every game/ path at most 1000 bytes.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};
writeFileSync(join(out, 'dossier.json'), buildDossier(out, CAPS));
