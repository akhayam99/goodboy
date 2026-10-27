import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DESKTOP = join(ROOT, 'apps', 'desktop');
const SOURCE = join(DESKTOP, 'src');
const TEST_FILE = /\.test\.tsx?$/;
const SCENE_BACKED = /MockScene\/|Seed['"]|sceneClock/;

const walk = ({ directory }) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'node_modules' ? [] : walk({ directory: path });
    }
    return TEST_FILE.test(entry.name) ? [path] : [];
  });

export const isSceneBacked = ({ source }) => SCENE_BACKED.test(source);

export const sceneBackedTests = ({ directory = SOURCE, base = DESKTOP } = {}) =>
  walk({ directory })
    .filter((path) => isSceneBacked({ source: readFileSync(path, 'utf8') }))
    .map((path) => relative(base, path))
    .sort();

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = sceneBackedTests();
  if (files.length === 0) {
    console.error('no scene-backed test found, the pattern or the folder moved');
    process.exit(1);
  }
  console.log(files.join('\n'));
}
