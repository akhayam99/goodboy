import { describe, expect, it } from 'vitest';
import { changeGateOf, changeRefusalOf, isChangeGateOn, type ChangeRules } from './changeGate';
import type { LaunchGuard } from './launchGuard';

const ASK_BOTH: ChangeRules = {
  rows: { dependencies: 'ask', protectedFiles: 'ask' },
  guard: null,
};

const ALLOW_BOTH: ChangeRules = {
  rows: { dependencies: 'allow', protectedFiles: 'allow' },
  guard: null,
};

const GUARD: LaunchGuard = {
  dependencies: 'ask',
  protectedFiles: 'ask',
  allowedPackages: [],
  allowedPaths: [],
};

const ALLOWED: ChangeRules = {
  ...ASK_BOTH,
  guard: {
    ...GUARD,
    dependencies: 'allow',
    allowedPackages: ['nock@14.0.1'],
    allowedPaths: ['.github/workflows/ci.yml'],
  },
};

type PatchParams = {
  readonly manifest: ReadonlyArray<string>;
};

const patchOf = ({ manifest }: PatchParams): string =>
  [
    'diff --git a/package.json b/package.json',
    '--- a/package.json',
    '+++ b/package.json',
    '@@ -10,3 +10,4 @@',
    ...manifest,
    'diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml',
    '--- a/pnpm-lock.yaml',
    '+++ b/pnpm-lock.yaml',
    '@@ -1,1 +1,2 @@',
    '+  nock: 14.0.1',
  ].join('\n');

describe('the landing backstop', () => {
  it('is off when both rows allow, whatever changed', () => {
    expect(isChangeGateOn({ rules: ALLOW_BOTH })).toBe(false);
    expect(
      changeGateOf({ rules: ALLOW_BOTH, paths: ['pnpm-lock.yaml', 'CODEOWNERS'], patch: null }),
    ).toEqual({ kind: 'clear' });
    expect(changeGateOf({ rules: ALLOW_BOTH, paths: null, patch: null })).toEqual({
      kind: 'clear',
    });
  });

  it('refuses a manifest or a lockfile in any folder while the dependency row asks', () => {
    expect(
      changeGateOf({
        rules: ASK_BOTH,
        paths: ['src/retry.ts', 'packages/ledger-core/package.json', 'Cargo.lock'],
        patch: null,
      }),
    ).toEqual({ kind: 'refused', paths: ['packages/ledger-core/package.json', 'Cargo.lock'] });
  });

  it('refuses a protected file the guard did not allow', () => {
    expect(
      changeGateOf({
        rules: { rows: { dependencies: 'allow', protectedFiles: 'ask' }, guard: null },
        paths: ['./.github/workflows/ci.yml', 'package.json'],
        patch: null,
      }),
    ).toEqual({ kind: 'refused', paths: ['.github/workflows/ci.yml'] });
  });

  it('lets a change through that an allowance of the attempt covers', () => {
    expect(
      changeGateOf({
        rules: ALLOWED,
        paths: ['pnpm-lock.yaml', 'package.json', '.github/workflows/ci.yml'],
        patch: patchOf({ manifest: ['+    "nock": "^14.0.1",'] }),
      }),
    ).toEqual({ kind: 'clear' });
    expect(
      changeGateOf({ rules: ALLOWED, paths: ['.github/workflows/release.yml'], patch: '' }),
    ).toEqual({ kind: 'refused', paths: ['.github/workflows/release.yml'] });
  });

  it('refuses a package or a version the allowance does not name', () => {
    const paths = ['package.json', 'pnpm-lock.yaml'];
    const other = patchOf({ manifest: ['+    "nock": "^14.0.1",', '+    "left-pad": "1.3.0",'] });
    const version = patchOf({ manifest: ['+    "nock": "^15.0.0",'] });
    const script = patchOf({ manifest: ['-    "test": "vitest",', '+    "test": "vitest run",'] });

    for (const patch of [other, version, script]) {
      expect(changeGateOf({ rules: ALLOWED, paths, patch })).toEqual({ kind: 'refused', paths });
    }
  });

  it('holds a lockfile the manifest change does not explain', () => {
    expect(
      changeGateOf({
        rules: ALLOWED,
        paths: ['pnpm-lock.yaml'],
        patch: patchOf({ manifest: [] }),
      }),
    ).toEqual({ kind: 'refused', paths: ['pnpm-lock.yaml'] });
    expect(
      changeGateOf({
        rules: ALLOWED,
        paths: ['package.json', 'pnpm-lock.yaml'],
        patch: null,
      }),
    ).toEqual({ kind: 'refused', paths: ['package.json', 'pnpm-lock.yaml'] });
  });

  it('takes a moved line, a new block and an older version of the allowed package', () => {
    const patch = patchOf({
      manifest: [
        '-    "msw": "^2.0.0"',
        '+    "msw": "^2.0.0",',
        '+  "devDependencies": {',
        '-    "nock": "^13.5.0",',
        '+    "nock": "14.0.1"',
        '+  },',
      ],
    });
    expect(
      changeGateOf({ rules: ALLOWED, paths: ['package.json', 'pnpm-lock.yaml'], patch }),
    ).toEqual({ kind: 'clear' });
  });

  it('refuses when the changed files could not be read', () => {
    expect(changeGateOf({ rules: ASK_BOTH, paths: null, patch: null })).toEqual({
      kind: 'unread',
    });
    expect(changeRefusalOf({ verdict: { kind: 'unread' }, stage: 'landing' })).toBe(
      'the changed files could not be read, so its checks did not run and nothing landed',
    );
  });

  it('names the first files and counts the rest', () => {
    expect(
      changeRefusalOf({
        verdict: {
          kind: 'refused',
          paths: ['a/package.json', 'b/package.json', 'c/package.json', 'go.sum'],
        },
        stage: 'publish',
      }),
    ).toBe(
      'it changed a/package.json, b/package.json, c/package.json and 1 more, which no allowance covers, so nothing was pushed',
    );
  });
});
