// @vitest-environment node
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';
import {
  IS_UPDATING,
  grownEntries,
  nonZero,
  readBaseline,
  writeBaseline,
  type FileCounts,
  type SourceFile,
} from './scanControls';

const BASELINE_FILE = 'rust-spawn-sites.baseline.json';
const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const RUST_SOURCE = join(REPO_ROOT, 'apps', 'desktop', 'src-tauri', 'src');
const PROC_PREFIX = 'apps/desktop/src-tauri/src/proc/';
const TEST_MODULE = /^#\[cfg\([^\n]*test[^\n]*\)\]\n(?:pub(?:\([a-z]+\)\s)?\s?)?mod /m;
const SPAWN_SITE = /\.(?:spawn|kill)\(\)/g;

const walk = (directory: string): ReadonlyArray<string> => {
  if (!existsSync(directory)) {
    return [];
  }
  return readdirSync(directory).flatMap((entry) => {
    const full = join(directory, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
};

const rustSources = (): ReadonlyArray<SourceFile> =>
  walk(RUST_SOURCE)
    .filter((full) => full.endsWith('.rs'))
    .map((full) => ({
      path: relative(REPO_ROOT, full).split(sep).join('/'),
      text: readFileSync(full, 'utf8'),
    }))
    .sort((left, right) => left.path.localeCompare(right.path));

const productPart = ({ text }: { readonly text: string }): string => {
  const cut = text.search(TEST_MODULE);
  return cut === -1 ? text : text.slice(0, cut);
};

const countSpawnSites = ({ text }: { readonly text: string }): number => {
  const code = productPart({ text })
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
  return (code.match(SPAWN_SITE) ?? []).length;
};

const measure = ({ files }: { readonly files: ReadonlyArray<SourceFile> }): FileCounts =>
  nonZero({
    counts: Object.fromEntries(
      files
        .filter(({ path }) => !path.startsWith(PROC_PREFIX))
        .map(({ path, text }) => [path, countSpawnSites({ text })]),
    ),
  });

describe('processes are started and killed through src-tauri/src/proc', () => {
  it('counts .spawn() and .kill() calls in product code, comments and test modules aside', () => {
    expect(countSpawnSites({ text: 'let child = command.spawn()?;' })).toBe(1);
    expect(countSpawnSites({ text: 'child.kill();\nchild.kill();' })).toBe(2);
    expect(countSpawnSites({ text: '// command.spawn()\nlet x = 1;' })).toBe(0);
    expect(countSpawnSites({ text: 'scope.spawn(move || run());' })).toBe(0);
    expect(countSpawnSites({ text: 'std::thread::spawn(run);' })).toBe(0);
    expect(
      countSpawnSites({
        text: 'fn a() { c.spawn(); }\n#[cfg(test)]\nmod tests {\n    fn t() { c.spawn(); c.kill(); }\n}\n',
      }),
    ).toBe(1);
    expect(
      countSpawnSites({
        text: '#[cfg(all(test, unix))]\npub(crate) mod tests {\n    fn t() { c.spawn(); }\n}\n',
      }),
    ).toBe(0);
    expect(countSpawnSites({ text: '' })).toBe(0);
    expect(countSpawnSites({ text: `${'x.spawn() '.repeat(10_000)}` })).toBe(10_000);
  });

  it('leaves proc/ out of the count', () => {
    const counts = measure({
      files: [
        { path: `${PROC_PREFIX}reap.rs`, text: 'child.kill();' },
        { path: 'apps/desktop/src-tauri/src/other.rs', text: 'child.kill();' },
      ],
    });
    expect(counts).toEqual({ 'apps/desktop/src-tauri/src/other.rs': 1 });
  });

  it('adds no .spawn() or .kill() outside proc/ beyond the baseline', () => {
    const current = measure({ files: rustSources() });
    if (IS_UPDATING) {
      writeBaseline({ file: BASELINE_FILE, counts: current });
      return;
    }
    const grown = grownEntries({ current, baseline: readBaseline({ file: BASELINE_FILE }) });
    expect(
      grown,
      `Start and stop processes through src-tauri/src/proc (docs/architecture.md, Processes Goodboy starts). A cleanup that lowers a count regenerates the baseline with GOODBOY_UPDATE_BASELINE=1.\n${grown.join('\n')}`,
    ).toEqual([]);
  });

  it('fails when a file outside proc/ gains a .spawn()', () => {
    const baseline = measure({
      files: [{ path: 'apps/desktop/src-tauri/src/runner.rs', text: 'a.spawn();' }],
    });
    const current = measure({
      files: [
        { path: 'apps/desktop/src-tauri/src/runner.rs', text: 'a.spawn();\nb.spawn();' },
        { path: 'apps/desktop/src-tauri/src/fresh.rs', text: 'c.spawn();' },
      ],
    });
    expect(grownEntries({ current, baseline })).toEqual([
      '  - apps/desktop/src-tauri/src/runner.rs: 2 (baseline 1)',
      '  - apps/desktop/src-tauri/src/fresh.rs: 1 (baseline 0)',
    ]);
  });

  it('names only files that still exist', () => {
    const present = new Set(rustSources().map(({ path }) => path));
    const gone = Object.keys(readBaseline({ file: BASELINE_FILE })).filter(
      (path) => !present.has(path),
    );
    expect(gone).toEqual([]);
  });
});
