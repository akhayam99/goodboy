import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { compactPath } from './lib/compactPath.mjs';

const REPOSITORY_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ICONS_DIRECTORY = resolve(REPOSITORY_DIRECTORY, 'packages/ui/src/icons');
const INDEX_PATH = resolve(ICONS_DIRECTORY, 'index.ts');
const GENERATED_DIRECTORY = resolve(ICONS_DIRECTORY, 'generated');
const GENERATED_IMPORT = /from '\.\/generated\/(\w+)';$/gm;
const BASE_WEIGHTS = ['regular'];
const EXTRA_WEIGHTS = {
  ClipboardText: ['duotone'],
  FileText: ['duotone'],
  Layout: ['duotone'],
  Star: ['fill'],
};
const SHADE_OPACITY = '0.2';

const glyphNamesOf = ({ indexSource }) =>
  [...new Set([...indexSource.matchAll(GENERATED_IMPORT)].map((match) => match[1]))].sort();

const definitionsDirectory = () =>
  resolve(dirname(fileURLToPath(import.meta.resolve('@phosphor-icons/react'))), 'defs');

const pathsOf = ({ fragment }) => [fragment.props.children].flat().map((child) => child.props);

const singlePath = ({ name, weight, paths }) => {
  if (paths.length !== 1 || paths[0].opacity !== undefined) {
    throw new Error(`${name} ${weight} is not one plain path`);
  }
  return compactPath({ d: paths[0].d });
};

const duotoneOf = ({ name, paths }) => {
  const [shade, line] = paths;
  if (paths.length !== 2 || shade.opacity !== SHADE_OPACITY || line.opacity !== undefined) {
    throw new Error(`${name} duotone is not one shade and one line`);
  }
  return { shade: compactPath({ d: shade.d }), line: compactPath({ d: line.d }) };
};

const drawingOf = ({ name, weights }) =>
  Object.fromEntries(
    [...BASE_WEIGHTS, ...(EXTRA_WEIGHTS[name] ?? [])].map((weight) => {
      const paths = weights.get(weight);
      if (weight === 'duotone') {
        return [weight, duotoneOf({ name, paths })];
      }
      return [weight, singlePath({ name, weight, paths })];
    }),
  );

const glyphSource = async ({ name, weights }) => {
  const options = JSON.stringify({ name, drawing: drawingOf({ name, weights }) }, null, 2);
  return format(
    ["import { glyph } from '../glyph';", `export const ${name} = glyph(${options});`].join('\n\n'),
    { ...(await resolveConfig(INDEX_PATH)), parser: 'typescript' },
  );
};

const readWeights = async ({ name }) => {
  const url = pathToFileURL(resolve(definitionsDirectory(), `${name}.es.js`)).href;
  const definitions = Object.values(await import(url))[0];
  return new Map([...definitions].map(([weight, fragment]) => [weight, pathsOf({ fragment })]));
};

const generatedFiles = async ({ names }) =>
  new Map(
    await Promise.all(
      names.map(async (name) => [
        `${name}.ts`,
        await glyphSource({ name, weights: await readWeights({ name }) }),
      ]),
    ),
  );

const listGenerated = () => {
  try {
    return readdirSync(GENERATED_DIRECTORY);
  } catch {
    return [];
  }
};

const staleFiles = ({ files }) => {
  const written = listGenerated();
  return [
    ...written.filter((file) => !files.has(file)),
    ...[...files.keys()].filter(
      (file) =>
        !written.includes(file) ||
        readFileSync(resolve(GENERATED_DIRECTORY, file), 'utf8') !== files.get(file),
    ),
  ];
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const names = glyphNamesOf({ indexSource: readFileSync(INDEX_PATH, 'utf8') });
  const files = await generatedFiles({ names });
  if (process.argv.includes('--check')) {
    const stale = staleFiles({ files });
    stale.forEach((file) => console.error(`glyphs: ${file} is out of date`));
    console.log(
      stale.length === 0 ? 'glyphs ok' : 'glyphs stale: node scripts/generate-glyphs.mjs',
    );
    process.exit(stale.length === 0 ? 0 : 1);
  }
  rmSync(GENERATED_DIRECTORY, { recursive: true, force: true });
  mkdirSync(GENERATED_DIRECTORY, { recursive: true });
  files.forEach((source, file) => writeFileSync(resolve(GENERATED_DIRECTORY, file), source));
  console.log(`glyphs: wrote ${files.size} files`);
}
