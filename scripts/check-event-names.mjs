import { readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RUST_DIRECTORY = resolve(ROOT_DIRECTORY, 'apps/desktop/src-tauri/src');
const FRONTEND_DIRECTORY = resolve(ROOT_DIRECTORY, 'apps/desktop/src');
const EVENT_DOC_PATH = resolve(ROOT_DIRECTORY, 'docs/event-bus.md');
const RUST_SECTION_HEADING = '## Events from Rust';
const WINDOW_EVENT_PREFIX = 'goodboy:';
const IGNORED_WINDOW_EVENTS = new Set([
  'goodboy:test-pref',
  'goodboy:test-flag',
  'goodboy:goal-hint-dismissed',
]);

const RUST_CONSTANT =
  /\bconst\s+[A-Z0-9_]*EVENT[A-Z0-9_]*\s*:\s*&(?:'static\s+)?str\s*=\s*"([^"]+)"/g;
const RUST_LITERAL_EMIT = /\bemit\(\s*"([^"]+)"/g;
const FRONTEND_CONSTANT = /\bconst\s+([A-Z][A-Z0-9_]*)\s*=\s*(['"])([^'"]+)\2/g;
const FRONTEND_CALL = /\b(listen|emit)(?:<[^>()]*>)?\(\s*(?:(['"])([^'"]+)\2|([A-Z][A-Z0-9_]*))/g;
const WINDOW_EVENT_LITERAL = /(['"`])(goodboy:[a-z][a-z-]*)(?::[^'"`]*)?\1/g;

const isTestPath = ({ path }) =>
  /\.test\.tsx?$/.test(path) ||
  path.includes('/__tests__/') ||
  path.includes('/MockScene/') ||
  path.endsWith('/storyHarness.ts') ||
  path.endsWith('/mock-data.ts');

const collectFiles = ({ directory, extensions }) => {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'target' || entry.name === 'dist') {
        continue;
      }
      files.push(...collectFiles({ directory: path, extensions }));
      continue;
    }
    if (entry.isFile() && extensions.includes(extname(entry.name))) {
      files.push(path);
    }
  }
  return files;
};

export const rustEventNames = ({ sources }) => {
  const names = new Set();
  for (const { text } of sources) {
    for (const match of text.matchAll(RUST_CONSTANT)) {
      names.add(match[1]);
    }
    for (const match of text.matchAll(RUST_LITERAL_EMIT)) {
      names.add(match[1]);
    }
  }
  return names;
};

export const frontendTauriCalls = ({ sources }) => {
  const listened = new Set();
  const emitted = new Set();
  const literals = new Set();
  for (const { text } of sources) {
    const constants = new Map();
    for (const match of text.matchAll(FRONTEND_CONSTANT)) {
      constants.set(match[1], match[3]);
      literals.add(match[3]);
    }
    for (const match of text.matchAll(/(['"])([^'"\s]+)\1/g)) {
      literals.add(match[2]);
    }
    for (const match of text.matchAll(FRONTEND_CALL)) {
      const name = match[3] ?? constants.get(match[4]);
      if (name === undefined) {
        continue;
      }
      (match[1] === 'listen' ? listened : emitted).add(name);
    }
  }
  return { listened, emitted, literals };
};

export const windowEventNames = ({ sources }) => {
  const names = new Set();
  for (const { text } of sources) {
    for (const match of text.matchAll(WINDOW_EVENT_LITERAL)) {
      if (!IGNORED_WINDOW_EVENTS.has(match[2])) {
        names.add(match[2]);
      }
    }
  }
  return names;
};

const backticked = ({ doc }) =>
  new Set(
    [...doc.matchAll(/`([^`\s]+)`/g)].flatMap((match) => [
      match[1],
      match[1].replace(/:<[^>]*>(?::<[^>]*>)*$/, ''),
    ]),
  );

const sectionOf = ({ doc, heading }) => {
  const start = doc.indexOf(heading);
  if (start === -1) {
    return '';
  }
  const rest = doc.slice(start + heading.length);
  const next = rest.search(/\n## /);
  return next === -1 ? rest : rest.slice(0, next);
};

export const verifyEventNames = ({ rustNames, frontend, windowNames, doc }) => {
  const problems = [];
  const rustSection = backticked({ doc: sectionOf({ doc, heading: RUST_SECTION_HEADING }) });
  const documented = backticked({ doc });
  for (const name of [...rustNames].sort()) {
    if (!frontend.literals.has(name)) {
      problems.push(`Rust emits "${name}" and no frontend file names it`);
    }
    if (!rustSection.has(name)) {
      problems.push(`"${name}" is emitted by Rust and missing from "${RUST_SECTION_HEADING}"`);
    }
  }
  for (const name of [...frontend.listened].sort()) {
    if (!rustNames.has(name) && !frontend.emitted.has(name)) {
      problems.push(`the frontend listens to "${name}" and neither Rust nor the frontend emits it`);
    }
  }
  for (const name of [...windowNames].sort()) {
    if (name.startsWith(WINDOW_EVENT_PREFIX) && !documented.has(name)) {
      problems.push(`window event "${name}" is not in docs/event-bus.md`);
    }
  }
  return problems;
};

const readSources = ({ directory, extensions, isIncluded }) =>
  collectFiles({ directory, extensions })
    .filter((path) => isIncluded({ path }))
    .map((path) => ({ path: relative(ROOT_DIRECTORY, path), text: readFileSync(path, 'utf8') }));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rustSources = readSources({
    directory: RUST_DIRECTORY,
    extensions: ['.rs'],
    isIncluded: () => true,
  });
  const frontendSources = readSources({
    directory: FRONTEND_DIRECTORY,
    extensions: ['.ts', '.tsx'],
    isIncluded: ({ path }) => !isTestPath({ path }),
  });
  const rustNames = rustEventNames({ sources: rustSources });
  if (rustNames.size === 0) {
    throw new Error('No Rust event names found');
  }
  const windowNames = windowEventNames({ sources: frontendSources });
  const problems = verifyEventNames({
    rustNames,
    frontend: frontendTauriCalls({ sources: frontendSources }),
    windowNames,
    doc: readFileSync(EVENT_DOC_PATH, 'utf8'),
  });
  if (problems.length > 0) {
    console.error(problems.join('\n'));
    process.exitCode = 1;
  } else {
    console.log(
      `Event names OK: ${rustNames.size} Rust events, ${windowNames.size} window events documented`,
    );
  }
}
