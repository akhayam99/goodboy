import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSceneBacked } from './scene-backed-tests.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DESKTOP = 'apps/desktop';
const SOURCE_ROOTS = ['apps/desktop/src', 'apps/desktop/vite', 'packages'];
const SOURCE_FILE = /\.tsx?$/;
const TEST_FILE = /\.test\.tsx?$/;
const A11Y_TEST = /^apps[/]desktop[/]src[/]__tests__[/]a11y[/]/;
const PERF_TEST = /\.perf\.test\.tsx?$/;
const SKIPPED_FOLDERS = new Set(['node_modules', 'dist', 'coverage']);
const DISK_READER = /node:fs|from 'fs'|from "fs"|fs\/promises|import\.meta\.glob/;
const ALWAYS_RUN = /^apps[/]desktop[/]src[/]__tests__[/]regressions[/]/;
const FROM_PATTERN = /\bfrom\s*['"]([^'"\n]+)['"]/g;
const DYNAMIC_PATTERN = /\bimport\(\s*['"]([^'"\n]+)['"]\s*\)/g;
const SPECIFIER_PATTERNS = [
  FROM_PATTERN,
  /\bimport\s*['"]([^'"\n]+)['"]/g,
  DYNAMIC_PATTERN,
  /\bvi\.(?:mock|doMock|importActual|importMock)(?:<[^>\n]*>)?\(\s*['"]([^'"\n]+)['"]/g,
  /\bnew URL\(\s*['"](\.[^'"\n]+)['"]\s*,\s*import\.meta\.url/g,
];
const TYPE_ONLY_HEAD = /^(?:import|export)\s+type[\s{*]/;
const BRACED_HEAD = /^(?:import|export)\s*\{([^}]*)\}$/;
const TYPEOF_BEFORE = /\btypeof\s*$/;
const READ_ROOTS = new Set(['docs', 'packages', 'website']);
const ROOT_DOC = /^[A-Z][A-Z0-9_-]*\.md$/;
const READ_CALL = /\b(?:join|resolve)\(([^()]*)\)/g;
const READ_URL = /new URL\(\s*(?:'([^'\n]*)'|"([^"\n]*)")\s*,\s*import\.meta\.url/g;
const QUOTED = /'([^'\n]*)'|"([^"\n]*)"/g;
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

const statementHeadOf = ({ source, index }) => {
  const start = Math.max(source.lastIndexOf('import', index), source.lastIndexOf('export', index));
  return start < 0 ? '' : source.slice(start, index).trim();
};

const isTypeOnlyHead = ({ head }) => {
  if (TYPE_ONLY_HEAD.test(head)) {
    return true;
  }
  const braced = BRACED_HEAD.exec(head);
  if (braced === null) {
    return false;
  }
  const members = braced[1]
    .split(',')
    .map((member) => member.trim())
    .filter((member) => member.length > 0);
  return members.length > 0 && members.every((member) => member.startsWith('type '));
};

const isTypeOnlyMatch = ({ source, pattern, match }) => {
  if (pattern === FROM_PATTERN) {
    return isTypeOnlyHead({ head: statementHeadOf({ source, index: match.index }) });
  }
  if (pattern === DYNAMIC_PATTERN) {
    return TYPEOF_BEFORE.test(source.slice(Math.max(0, match.index - 12), match.index));
  }
  return false;
};

export const specifiersOf = ({ source, isTypeOnlySkipped = false }) => {
  const found = new Set();
  for (const pattern of SPECIFIER_PATTERNS) {
    for (const match of source.matchAll(pattern)) {
      if (isTypeOnlySkipped && isTypeOnlyMatch({ source, pattern, match })) {
        continue;
      }
      found.add(match[1].replace(/\?.*$/, ''));
    }
  }
  return [...found];
};

const readPathOf = ({ literals }) => {
  const start = literals.findIndex(
    (literal) => READ_ROOTS.has(literal.split('/')[0]) || ROOT_DOC.test(literal),
  );
  return start < 0 ? null : literals.slice(start).join('/');
};

export const pathsReadOf = ({ source, file }) => {
  const read = [];
  for (const call of source.matchAll(READ_CALL)) {
    const path = readPathOf({
      literals: [...call[1].matchAll(QUOTED)].map((match) => match[1] ?? match[2]),
    });
    if (path !== null) {
      read.push(path);
    }
  }
  for (const call of source.matchAll(READ_URL)) {
    const target = posix.normalize(posix.join(posix.dirname(file), call[1] ?? call[2]));
    if (READ_ROOTS.has(target.split('/')[0]) || ROOT_DOC.test(target)) {
      read.push(target);
    }
  }
  return read;
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

export const buildGraph = ({ root = ROOT, isTypeOnlySkipped = false } = {}) => {
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
    for (const specifier of specifiersOf({ source, isTypeOnlySkipped })) {
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

const isPackageUnitTest = ({ file }) =>
  file.startsWith('packages/') && TEST_FILE.test(file) && !PERF_TEST.test(file);

const isAlwaysRun = ({ graph, file }) =>
  ALWAYS_RUN.test(file) || DISK_READER.test(graph.sources.get(file) ?? '');

const packagesOf = ({ files }) => {
  const packages = {};
  for (const file of files) {
    const [, name, ...rest] = file.split('/');
    packages[name] = [...(packages[name] ?? []), rest.join('/')];
  }
  return packages;
};

const packageTestsOf = ({ graph, reached }) =>
  packagesOf({
    files: graph.files.filter(
      (file) => isPackageUnitTest({ file }) && (reached.has(file) || isAlwaysRun({ graph, file })),
    ),
  });

export const relatedSelection = ({ graph, changed }) => {
  const reached = reachedFrom({ graph, changed });
  const desktopTests = graph.files.filter((file) => isDesktopUnitTest({ file }));
  const desktop = desktopTests.filter((file) => reached.has(file) || isAlwaysRun({ graph, file }));
  const zones = desktop.filter((file) => isSceneBacked({ source: graph.sources.get(file) ?? '' }));
  const isA11yReached = graph.files.some((file) => A11Y_TEST.test(file) && reached.has(file));
  return {
    desktop: desktop.map((file) => file.slice(`${DESKTOP}/`.length)),
    desktopTotal: desktopTests.length,
    zones: zones.map((file) => file.slice(`${DESKTOP}/`.length)),
    packages: packageTestsOf({ graph, reached }),
    isA11yReached,
  };
};

const isUnitTest = ({ file }) => isDesktopUnitTest({ file }) || isPackageUnitTest({ file });

const readsPath = ({ graph, file, path }) => {
  const source = graph.sources.get(file) ?? '';
  if (!DISK_READER.test(source)) {
    return false;
  }
  const name = posix.basename(path);
  if (source.includes(`'${name}'`) || source.includes(`"${name}"`)) {
    return true;
  }
  return pathsReadOf({ source, file }).some((read) => path === read || path.startsWith(`${read}/`));
};

export const testsReadingOf = ({ graph, path }) => {
  const reached = reachedFrom({ graph, changed: [path] });
  return graph.files.filter(
    (file) => isUnitTest({ file }) && (reached.has(file) || readsPath({ graph, file, path })),
  );
};

const testStemOf = ({ file }) => posix.basename(file).replace(TEST_FILE, '');

export const baselineReadersOf = ({ graph, path }) => {
  const name = posix.basename(path);
  const guards = graph.files.filter((file) => ALWAYS_RUN.test(file) && isDesktopUnitTest({ file }));
  const naming = guards.filter((file) => (graph.sources.get(file) ?? '').includes(name));
  if (naming.length > 0) {
    return naming;
  }
  const stem = name.replace(/\.baseline\.json$/, '');
  const prefixes = guards.filter((file) => {
    const guard = testStemOf({ file });
    return stem === guard || stem.startsWith(`${guard}.`) || stem.startsWith(`${guard}-`);
  });
  const longest = Math.max(0, ...prefixes.map((file) => testStemOf({ file }).length));
  return prefixes.filter((file) => testStemOf({ file }).length === longest);
};

export const testsSelection = ({ files }) => ({
  desktop: files
    .filter((file) => isDesktopUnitTest({ file }))
    .map((file) => file.slice(`${DESKTOP}/`.length)),
  packages: packagesOf({ files: files.filter((file) => isPackageUnitTest({ file })) }),
});

export const selectionLines = ({ selection }) => [
  ...selection.desktop.map((file) => `desktop ${file}`),
  ...Object.entries(selection.packages).flatMap(([name, files]) =>
    files.map((file) => `${name} ${file}`),
  ),
];
