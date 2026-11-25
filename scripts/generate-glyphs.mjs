import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { carbonPathOf } from './lib/carbonPathOf.mjs';
import { compactPath } from './lib/compactPath.mjs';

const REPOSITORY_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ICONS_DIRECTORY = resolve(REPOSITORY_DIRECTORY, 'packages/ui/src/icons');
const INDEX_PATH = resolve(ICONS_DIRECTORY, 'index.ts');
const GENERATED_DIRECTORY = resolve(ICONS_DIRECTORY, 'generated');
const GENERATED_IMPORT = /from '\.\/generated\/(\w+)';$/gm;
const ARTBOARD = '32';
const FILL_SOURCES = {
  Star: 'star--filled',
};

const glyphNamesOf = ({ indexSource }) =>
  [...new Set([...indexSource.matchAll(GENERATED_IMPORT)].map((match) => match[1]))].sort();

const definitionsDirectory = () =>
  resolve(dirname(fileURLToPath(import.meta.resolve('@carbon/icons/metadata.json'))), 'es');

const pascalNameOf = ({ module }) =>
  module
    .split(/-+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

const modulesByName = () => {
  const modules = new Map();
  readdirSync(definitionsDirectory()).forEach((module) => {
    const name = pascalNameOf({ module });
    if (modules.has(name)) {
      throw new Error(`${module} and ${modules.get(name)} share the name ${name}`);
    }
    modules.set(name, module);
  });
  return modules;
};

const descriptorOf = async ({ module }) => {
  const directory = resolve(definitionsDirectory(), module);
  const artboard = readdirSync(directory).includes(`${ARTBOARD}.js`)
    ? ARTBOARD
    : readdirSync(directory)
        .filter((file) => /^\d+\.js$/.test(file))
        .map((file) => file.replace('.js', ''))
        .sort((left, right) => Number(right) - Number(left))[0];
  const url = pathToFileURL(resolve(directory, `${artboard}.js`)).href;
  return (await import(url)).default;
};

const drawingOf = async ({ name, modules }) => {
  const module = modules.get(name);
  if (module == null) {
    throw new Error(`${name} is not a Carbon icon`);
  }
  const regular = compactPath({ d: carbonPathOf({ descriptor: await descriptorOf({ module }) }) });
  const fillModule = FILL_SOURCES[name];
  if (fillModule == null) {
    return { regular };
  }
  const fill = compactPath({
    d: carbonPathOf({ descriptor: await descriptorOf({ module: fillModule }) }),
  });
  return { regular, fill };
};

const glyphSource = async ({ name, drawing }) => {
  const options = JSON.stringify({ name, drawing }, null, 2);
  return format(
    ["import { glyph } from '../glyph';", `export const ${name} = glyph(${options});`].join('\n\n'),
    { ...(await resolveConfig(INDEX_PATH)), parser: 'typescript' },
  );
};

const generatedFiles = async ({ names }) => {
  const modules = modulesByName();
  return new Map(
    await Promise.all(
      names.map(async (name) => [
        `${name}.ts`,
        await glyphSource({ name, drawing: await drawingOf({ name, modules }) }),
      ]),
    ),
  );
};

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
