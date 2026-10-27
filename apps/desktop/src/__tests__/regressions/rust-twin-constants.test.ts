// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const DESKTOP_SRC = join(__dirname, '..', '..');
const REPO_ROOT = join(DESKTOP_SRC, '..', '..', '..');
const RUST_SRC = join(REPO_ROOT, 'apps', 'desktop', 'src-tauri', 'src');

type FileParams = {
  readonly root: string;
  readonly path: string;
};

const read = ({ root, path }: FileParams): string => readFileSync(join(root, path), 'utf8');

type NameParams = {
  readonly source: string;
  readonly name: string;
};

const escaped = (name: string): string => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const rustString = ({ source, name }: NameParams): string | undefined =>
  new RegExp(`const ${escaped(name)}: &str = "([^"]*)";`).exec(source)?.[1];

const rustNumber = ({ source, name }: NameParams): number | undefined => {
  const found = new RegExp(`const ${escaped(name)}: u32 = (\\d+);`).exec(source)?.[1];
  return found === undefined ? undefined : Number(found);
};

const QUOTED = /"([^"]*)"|'([^']*)'/g;

type ListParams = {
  readonly body: string | undefined;
};

const quotedValues = ({ body }: ListParams): ReadonlyArray<string> =>
  [...(body ?? '').matchAll(QUOTED)].flatMap((match) => {
    const value = match[1] ?? match[2];
    return value === undefined ? [] : [value];
  });

const rustList = ({ source, name }: NameParams): ReadonlyArray<string> =>
  quotedValues({
    body: new RegExp(`const ${escaped(name)}: \\[&str; \\d+\\] = \\[([^\\]]*)\\];`).exec(
      source,
    )?.[1],
  });

const tsString = ({ source, name }: NameParams): string | undefined =>
  new RegExp(`export const ${escaped(name)} = '([^']*)'`).exec(source)?.[1];

const tsNumber = ({ source, name }: NameParams): number | undefined => {
  const found = new RegExp(`export const ${escaped(name)} = (\\d+)`).exec(source)?.[1];
  return found === undefined ? undefined : Number(found);
};

const tsList = ({ source, name }: NameParams): ReadonlyArray<string> =>
  quotedValues({
    body: new RegExp(`export const ${escaped(name)} = \\[([^\\]]*)\\]`).exec(source)?.[1],
  });

const tsUnion = ({ source, name }: NameParams): ReadonlyArray<string> =>
  quotedValues({
    body: new RegExp(`export type ${escaped(name)} =([^;]*);`).exec(source)?.[1],
  });

describe('constants that Rust and TypeScript each spell out', () => {
  it('keeps the interrupted-runs settings key identical', () => {
    const rust = rustString({
      source: read({ root: RUST_SRC, path: 'restart_marker.rs' }),
      name: 'INTERRUPTED_RUNS_KEY',
    });
    const ts = tsString({
      source: read({
        root: DESKTOP_SRC,
        path: 'store/slices/turn/restartMarker.ts',
      }),
      name: 'INTERRUPTED_RUNS_KEY',
    });

    expect(rust).toBe('restart.interrupted_runs');
    expect(ts).toBe(rust);
  });

  it('keeps the config bundle schema version identical', () => {
    const rust = rustNumber({
      source: read({ root: RUST_SRC, path: 'config_export/bundle.rs' }),
      name: 'SCHEMA_VERSION',
    });
    const ts = tsNumber({
      source: read({ root: REPO_ROOT, path: 'packages/types/src/config-bundle.ts' }),
      name: 'CONFIG_BUNDLE_SCHEMA_VERSION',
    });

    expect(rust).toBeGreaterThan(0);
    expect(ts).toBe(rust);
  });

  it('keeps the provider policy states identical', () => {
    const rust = rustList({
      source: read({ root: RUST_SRC, path: 'settings_overrides.rs' }),
      name: 'PROVIDER_POLICY_STATES',
    });
    const ts = tsList({
      source: read({ root: REPO_ROOT, path: 'packages/types/src/provider-policy.ts' }),
      name: 'PROVIDER_POLICY_STATES',
    });

    expect(rust).toHaveLength(3);
    expect(ts).toEqual(rust);
  });

  it('keeps the workspace override column list identical', () => {
    const rust = rustList({
      source: read({ root: RUST_SRC, path: 'settings_overrides.rs' }),
      name: 'OVERRIDE_COLUMNS',
    });
    const ts = tsList({
      source: read({ root: REPO_ROOT, path: 'packages/types/src/override-columns.ts' }),
      name: 'OVERRIDE_COLUMNS',
    });

    expect(rust).toHaveLength(18);
    expect(ts).toEqual(rust);
  });

  it('lets Rust accept every boot phase the store can name', () => {
    const rust = rustList({
      source: read({ root: RUST_SRC, path: 'boot_breadcrumb.rs' }),
      name: 'PHASES',
    });
    const ts = tsUnion({
      source: read({ root: DESKTOP_SRC, path: 'store/slices/boot/state.ts' }),
      name: 'BootPhase',
    });

    expect(ts.length).toBeGreaterThan(0);
    expect(ts.filter((phase) => !rust.includes(phase))).toEqual([]);
  });

  it('reads a value from Rust and TypeScript text and stops at a changed one', () => {
    const rust = 'const KEY: &str = "a.b";\nconst LIST: [&str; 2] = ["x", "y"];\nconst N: u32 = 4;';
    const ts = "export const KEY = 'a.c';\nexport const LIST = ['x', 'z'] as const;";

    expect(rustString({ source: rust, name: 'KEY' })).toBe('a.b');
    expect(rustNumber({ source: rust, name: 'N' })).toBe(4);
    expect(tsString({ source: ts, name: 'KEY' })).not.toBe(
      rustString({ source: rust, name: 'KEY' }),
    );
    expect(tsList({ source: ts, name: 'LIST' })).not.toEqual(
      rustList({ source: rust, name: 'LIST' }),
    );
  });
});
