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

const BASELINE_FILE = 'rust-platform-literals.baseline.json';
const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const RUST_SOURCE = join(REPO_ROOT, 'apps', 'desktop', 'src-tauri', 'src');
const OWNERS = ['apps/desktop/src-tauri/src/platform/', 'apps/desktop/src-tauri/src/path_env.rs'];
const TEST_MODULE = /^#\[cfg\([^\n]*test[^\n]*\)\]\n(?:pub(?:\([a-z]+\)\s)?\s?)?mod /m;
const PLATFORM_LITERAL =
  /Command::new\(|"\/bin\/(?:sh|bash|zsh)"|"bash"|\.split\(':'\)|\.join\(":"\)|var\("HOME"\)/g;

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

const countPlatformLiterals = ({ text }: { readonly text: string }): number => {
  const code = productPart({ text })
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
  return (code.match(PLATFORM_LITERAL) ?? []).length;
};

const isOwner = ({ path }: { readonly path: string }): boolean =>
  OWNERS.some((owner) => path.startsWith(owner));

const measure = ({ files }: { readonly files: ReadonlyArray<SourceFile> }): FileCounts =>
  nonZero({
    counts: Object.fromEntries(
      files
        .filter(({ path }) => !isOwner({ path }))
        .map(({ path, text }) => [path, countPlatformLiterals({ text })]),
    ),
  });

describe('only src-tauri/src/platform knows which system it runs on', () => {
  it('counts process builders, shell paths, path separators and HOME in product code', () => {
    expect(countPlatformLiterals({ text: 'let c = Command::new("git");' })).toBe(1);
    expect(countPlatformLiterals({ text: 'let b = CommandBuilder::new(&shell);' })).toBe(0);
    expect(countPlatformLiterals({ text: 'CommandBuilder::new("bash")' })).toBe(1);
    expect(countPlatformLiterals({ text: 'let s = "/bin/sh"; let z = "/bin/zsh";' })).toBe(2);
    expect(countPlatformLiterals({ text: 'path.split(\':\')\nparts.join(":")' })).toBe(2);
    expect(countPlatformLiterals({ text: 'std::env::var("HOME")' })).toBe(1);
    expect(countPlatformLiterals({ text: '// Command::new("git")' })).toBe(0);
    expect(
      countPlatformLiterals({
        text: 'fn a() {}\n#[cfg(test)]\nmod tests {\n    fn t() { Command::new("sh"); }\n}\n',
      }),
    ).toBe(0);
    expect(countPlatformLiterals({ text: `${'Command::new(x) '.repeat(10_000)}` })).toBe(10_000);
  });

  it('leaves the platform module and path_env out of the count', () => {
    const counts = measure({
      files: [
        { path: 'apps/desktop/src-tauri/src/platform/shell.rs', text: '"/bin/sh"' },
        { path: 'apps/desktop/src-tauri/src/path_env.rs', text: 'Command::new(b)' },
        { path: 'apps/desktop/src-tauri/src/other.rs', text: 'Command::new(b)' },
      ],
    });
    expect(counts).toEqual({ 'apps/desktop/src-tauri/src/other.rs': 1 });
  });

  it('adds no platform literal outside the platform module beyond the baseline', () => {
    const current = measure({ files: rustSources() });
    if (IS_UPDATING) {
      writeBaseline({ file: BASELINE_FILE, counts: current });
      return;
    }
    const grown = grownEntries({ current, baseline: readBaseline({ file: BASELINE_FILE }) });
    expect(
      grown,
      `Start processes with path_env::command and ask src-tauri/src/platform for shells, paths and the home folder (docs/architecture.md, Subprocess environment). A cleanup that lowers a count regenerates the baseline with GOODBOY_UPDATE_BASELINE=1.\n${grown.join('\n')}`,
    ).toEqual([]);
  });

  it('names only files that still exist', () => {
    const present = new Set(rustSources().map(({ path }) => path));
    const gone = Object.keys(readBaseline({ file: BASELINE_FILE })).filter(
      (path) => !present.has(path),
    );
    expect(gone).toEqual([]);
  });
});
