import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

export const glyphNamesOf = ({ indexSource }) =>
  [...new Set([...indexSource.matchAll(GENERATED_IMPORT)].map((match) => match[1]))].sort();

const definitionsDirectory = () => {
  const require = createRequire(resolve(REPOSITORY_DIRECTORY, 'packages/ui/package.json'));
  return resolve(dirname(require.resolve('@phosphor-icons/react')), 'defs');
};

const pathsOf = ({ fragment }) => [fragment.props.children].flat().map((child) => child.props);

const singlePath = ({ name, weight, paths }) => {
  if (paths.length !== 1 || paths[0].opacity !== undefined) {
    throw new Error(`${name} ${weight} is not one plain path`);
  }
  return paths[0].d;
};

const duotoneOf = ({ name, paths }) => {
  const [shade, line] = paths;
  if (paths.length !== 2 || shade.opacity !== SHADE_OPACITY || line.opacity !== undefined) {
    throw new Error(`${name} duotone is not one shade and one line`);
  }
  return { shade: shade.d, line: line.d };
};

export const drawingLines = ({ name, weights }) =>
  [...BASE_WEIGHTS, ...(EXTRA_WEIGHTS[name] ?? [])].flatMap((weight) => {
    const paths = weights.get(weight);
    if (weight === 'duotone') {
      const { shade, line } = duotoneOf({ name, paths });
      return ['    duotone: {', `      shade: '${shade}',`, `      line: '${line}',`, '    },'];
    }
    return [`    ${weight}: '${singlePath({ name, weight, paths })}',`];
  });

export const glyphSource = ({ name, weights }) =>
  [
    "import { glyph } from '../glyph';",
    '',
    `export const ${name} = glyph({`,
    `  name: '${name}',`,
    '  drawing: {',
    ...drawingLines({ name, weights }),
    '  },',
    '});',
    '',
  ].join('\n');

const readWeights = async ({ name }) => {
  const url = pathToFileURL(resolve(definitionsDirectory(), `${name}.es.js`)).href;
  const definitions = Object.values(await import(url))[0];
  return new Map(
    [...definitions].map(([weight, fragment]) => [weight, pathsOf({ fragment })]),
  );
};

export const generatedFiles = async ({ names }) =>
  new Map(
    await Promise.all(
      names.map(async (name) => [
        `${name}.ts`,
        glyphSource({ name, weights: await readWeights({ name }) }),
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
    console.log(stale.length === 0 ? 'glyphs ok' : 'glyphs stale: node scripts/generate-glyphs.mjs');
    process.exit(stale.length === 0 ? 0 : 1);
  }
  rmSync(GENERATED_DIRECTORY, { recursive: true, force: true });
  mkdirSync(GENERATED_DIRECTORY, { recursive: true });
  files.forEach((source, file) => writeFileSync(resolve(GENERATED_DIRECTORY, file), source));
  console.log(`glyphs: wrote ${files.size} files`);
}
