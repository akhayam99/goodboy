import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSceneBacked } from './scene-backed-tests.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DESKTOP = 'apps/desktop';
const SOURCE_ROOTS = ['apps/desktop/src', 'packages'];
const SOURCE_FILE = /\.tsx?$/;
const TEST_FILE = /\.test\.tsx?$/;
const A11Y_TEST = /^apps[/]desktop[/]src[/]__tests__[/]a11y[/]/;
const PERF_TEST = /\.perf\.test\.tsx?$/;
const SKIPPED_FOLDERS = new Set(['node_modules', 'dist', 'coverage']);
const DISK_READER = /node:fs|from 'fs'|from "fs"|fs\/promises|import\.meta\.glob/;
const ALWAYS_RUN = /^apps[/]desktop[/]src[/]__tests__[/]regressions[/]/;
const SPECIFIER_PATTERNS = [
  /\bfrom\s*['"]([^'"\n]+)['"]/g,
  /\bimport\s*['"]([^'"\n]+)['"]/g,
  /\bimport\(\s*['"]([^'"\n]+)['"]\s*\)/g,
  /\bvi\.(?:mock|doMock|importActual|importMock)(?:<[^>\n]*>)?\(\s*['"]([^'"\n]+)['"]/g,
  /\bnew URL\(\s*['"](\.[^'"\n]+)['"]\s*,\s*import\.meta\.url/g,
];
const RESOLVE_SUFFIXES = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];
const GLOB_CALL = /\bimport\.meta\.glob(?:<[^(]*>)?\(\s*(\[[^\]]*\]|['"][^'"\n]+['"])/g;
const STRING_LITERAL = /['"]([^'"\n]+)['"]/g;

const toPosix = ({ path }) => path.split('\\').join('/');

const walk = ({ directory }) => {
  if (!existsSync(directory)) {
    return [];
  }
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (SKIPPED_FOLDERS.has(entry.name)) {
      return [];
    }
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return walk({ directory: path });
    }
    return SOURCE_FILE.test(entry.name) ? [path] : [];
  });
};

export const specifiersOf = ({ source }) => {
  const found = new Set();
  for (const pattern of SPECIFIER_PATTERNS) {
    for (const match of source.matchAll(pattern)) {
      found.add(match[1].replace(/\?.*$/, ''));
    }
  }
  return [...found];
};

const globToRegExp = ({ pattern }) =>
  new RegExp(
    `^${pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*[/]/g, '\u0000')
      .replace(/\*/g, '[^/]*')
      .replace(/\u0000/g, '(?:.*/)?')}$`,
  );

export const globMatchesOf = ({ source, from, files }) => {
  const matches = new Set();
  for (const call of source.matchAll(GLOB_CALL)) {
    const patterns = [...call[1].matchAll(STRING_LITERAL)].map((literal) => literal[1]);
    const toPattern = ({ pattern }) =>
      globToRegExp({ pattern: toPosix({ path: join(dirname(from), pattern) }) });
    const included = patterns
      .filter((pattern) => !pattern.startsWith('!'))
      .map((pattern) => toPattern({ pattern }));
    const excluded = patterns
      .filter((pattern) => pattern.startsWith('!'))
      .map((pattern) => toPattern({ pattern: pattern.slice(1) }));
    for (const file of files) {
      if (
        included.some((regex) => regex.test(file)) &&
        !excluded.some((regex) => regex.test(file))
      ) {
        matches.add(file);
      }
    }
  }
  return [...matches];
};

const exportTargetOf = ({ exportsMap, subpath }) => {
  const exact = exportsMap[subpath];
  if (exact !== undefined) {
    return typeof exact === 'string' ? exact : exact.default;
  }
  for (const [key, value] of Object.entries(exportsMap)) {
    if (!key.includes('*')) {
      continue;
    }
    const [head, tail] = key.split('*');
    if (!subpath.startsWith(head) || !subpath.endsWith(tail)) {
      continue;
    }
    const middle = subpath.slice(head.length, subpath.length - tail.length);
    const target = typeof value === 'string' ? value : value.default;
    return target.replaceAll('*', middle);
  }
  return null;
};

export const workspacePackages = ({ root = ROOT } = {}) => {
  const packages = new Map();
  for (const name of readdirSync(join(root, 'packages'))) {
    const manifest = join(root, 'packages', name, 'package.json');
    if (!existsSync(manifest)) {
      continue;
    }
    const json = JSON.parse(readFileSync(manifest, 'utf8'));
    packages.set(json.name, { folder: `packages/${name}`, exportsMap: json.exports ?? {} });
  }
  return packages;
};

const fileExists = ({ root, path }) =>
  existsSync(join(root, path)) && statSync(join(root, path)).isFile();

export const resolveSpecifier = ({ root, from, specifier, packages }) => {
  if (specifier.startsWith('.')) {
    const base = toPosix({ path: join(dirname(from), specifier) });
    const candidates = RESOLVE_SUFFIXES.map((suffix) => posix.normalize(`${base}${suffix}`));
    const jsTwin = base.endsWith('.js')
      ? [`${base.slice(0, -3)}.ts`, `${base.slice(0, -3)}.tsx`]
      : [];
    return [...candidates, ...jsTwin].find((path) => fileExists({ root, path })) ?? null;
  }
  const scoped = specifier.match(/^(@goodboy\/[^/]+)(\/.*)?$/);
  if (scoped === null) {
    return undefined;
  }
  const workspacePackage = packages.get(scoped[1]);
  if (workspacePackage === undefined) {
    return undefined;
  }
  const target = exportTargetOf({
    exportsMap: workspacePackage.exportsMap,
    subpath: `.${scoped[2] ?? ''}`,
  });
  if (target === null) {
    return null;
  }
  const path = toPosix({ path: join(workspacePackage.folder, target) });
  return fileExists({ root, path }) ? path : null;
};

export const buildGraph = ({ root = ROOT } = {}) => {
  const packages = workspacePackages({ root });
  const files = SOURCE_ROOTS.flatMap((folder) => walk({ directory: join(root, folder) })).map(
    (path) => toPosix({ path: relative(root, path) }),
  );
  const importers = new Map();
  const unresolved = [];
  const sources = new Map();
  const addEdge = ({ target, file }) => {
    if (!importers.has(target)) {
      importers.set(target, new Set());
    }
    importers.get(target).add(file);
  };
  for (const file of files) {
    const source = readFileSync(join(root, file), 'utf8');
    sources.set(file, source);
    for (const specifier of specifiersOf({ source })) {
      const target = resolveSpecifier({ root, from: file, specifier, packages });
      if (target === undefined) {
        continue;
      }
      if (target === null) {
        unresolved.push({ file, specifier });
        continue;
      }
      addEdge({ target, file });
    }
    for (const target of globMatchesOf({ source, from: file, files })) {
      addEdge({ target, file });
    }
  }
  return { files, importers, unresolved, sources };
};

export const reachedFrom = ({ graph, changed }) => {
  const reached = new Set(changed);
  const queue = [...changed];
  while (queue.length > 0) {
    const file = queue.pop();
    for (const importer of graph.importers.get(file) ?? []) {
      if (!reached.has(importer)) {
        reached.add(importer);
        queue.push(importer);
      }
    }
  }
  return reached;
};

const isDesktopUnitTest = ({ file }) =>
  file.startsWith(`${DESKTOP}/`) &&
  TEST_FILE.test(file) &&
  !A11Y_TEST.test(file) &&
  !PERF_TEST.test(file);

export const relatedSelection = ({ graph, changed }) => {
  const reached = reachedFrom({ graph, changed });
  const desktopTests = graph.files.filter((file) => isDesktopUnitTest({ file }));
  const alwaysRun = desktopTests.filter(
    (file) => ALWAYS_RUN.test(file) || DISK_READER.test(graph.sources.get(file) ?? ''),
  );
  const desktop = desktopTests.filter((file) => reached.has(file) || alwaysRun.includes(file));
  const zones = desktop.filter((file) => isSceneBacked({ source: graph.sources.get(file) ?? '' }));
  const isA11yReached = graph.files.some((file) => A11Y_TEST.test(file) && reached.has(file));
  return {
    desktop: desktop.map((file) => file.slice(`${DESKTOP}/`.length)),
    desktopTotal: desktopTests.length,
    zones: zones.map((file) => file.slice(`${DESKTOP}/`.length)),
    isA11yReached,
  };
};
