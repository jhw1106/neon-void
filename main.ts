// NEON VOID — entrypoint: hand the game in.
// Node standard library only. It copies game/ and screenshots/ from this
// repository into the output directory and writes dossier.json there with
// buildDossier from vendor/makefun-game.ts. The output directory comes from
// MAKEFUN_OUTPUT_DIR, defaulting to /output. Every run writes the same
// bytes: the output directory is wiped first, files are copied by content,
// and buildDossier is deterministic.

import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR || '/output';

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, 'game'), join(out, 'game'), { recursive: true });
cpSync(join(root, 'screenshots'), join(out, 'screenshots'), { recursive: true });
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
