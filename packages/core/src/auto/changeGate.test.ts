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

type LockPatchParams = {
  readonly path?: string;
  readonly lines: ReadonlyArray<string>;
};

const lockPatchOf = ({ path = 'pnpm-lock.yaml', lines }: LockPatchParams): string =>
  [
    `diff --git a/${path} b/${path}`,
    `--- a/${path}`,
    `+++ b/${path}`,
    '@@ -1,9 +1,9 @@',
    ...lines,
  ].join('\n');

const ACME: ChangeRules = {
  ...ASK_BOTH,
  guard: { ...GUARD, dependencies: 'allow', allowedPackages: ['acme@1.0.0'] },
};

describe('an allowance names one package and one version', () => {
  it('refuses a second package or a second range on the line of the allowed one', () => {
    const paths = ['package.json'];
    for (const line of [
      '+    "acme": "1.0.0", "northwind": "9.0.0",',
      '+    "acme": "1.0.0 || 9.0.0",',
      '+    "acme": ">=1.0.0",',
      '+    "acme": "1.0.0 9.0.0",',
    ]) {
      expect(
        changeGateOf({
          rules: ACME,
          paths,
          patch: lockPatchOf({ path: 'package.json', lines: [line] }),
        }),
      ).toEqual({ kind: 'refused', paths });
    }
    expect(
      changeGateOf({
        rules: ACME,
        paths,
        patch: lockPatchOf({ path: 'package.json', lines: ['+    "acme": "^1.0.0",'] }),
      }),
    ).toEqual({ kind: 'clear' });
  });

  it('refuses a requirement range, a table or a second specifier', () => {
    const paths = ['requirements.txt'];
    for (const line of ['+acme>=1.0.0', '+acme==1.0.0,<2', '+acme[extra]==1.0.0', '+acme==9.0.0']) {
      expect(
        changeGateOf({
          rules: ACME,
          paths,
          patch: lockPatchOf({ path: 'requirements.txt', lines: [line] }),
        }),
      ).toEqual({ kind: 'refused', paths });
    }
    expect(
      changeGateOf({
        rules: ACME,
        paths,
        patch: lockPatchOf({ path: 'requirements.txt', lines: ['+acme==1.0.0'] }),
      }),
    ).toEqual({ kind: 'clear' });
  });

  it('takes a lockfile with the allowed package and what it depends on, and nothing else', () => {
    const added = [
      ' packages:',
      '+  acme@1.0.0:',
      '+    resolution: {integrity: sha512-acme}',
      '+  propagate@2.0.1:',
      '+    resolution: {integrity: sha512-propagate}',
      ' snapshots:',
      '+  acme@1.0.0:',
      '+    dependencies:',
      '+      propagate: 2.0.1',
      '+  propagate@2.0.1: {}',
    ];
    expect(
      changeGateOf({
        rules: ACME,
        paths: ['pnpm-lock.yaml'],
        patch: lockPatchOf({ lines: added }),
      }),
    ).toEqual({ kind: 'clear' });
    expect(
      changeGateOf({
        rules: ACME,
        paths: ['pnpm-lock.yaml'],
        patch: lockPatchOf({ lines: [' snapshots:', '-  acme@0.9.0: {}', '+  acme@1.0.0: {}'] }),
      }),
    ).toEqual({ kind: 'clear' });
    for (const extra of [['+  left-pad@1.3.0: {}'], ['-  acme@0.9.0: {}', '+  acme@9.0.0: {}']]) {
      expect(
        changeGateOf({
          rules: ACME,
          paths: ['pnpm-lock.yaml'],
          patch: lockPatchOf({ lines: [...added, ...extra] }),
        }),
      ).toEqual({ kind: 'refused', paths: ['pnpm-lock.yaml'] });
    }
  });

  it('reads an npm lock by its node_modules entries', () => {
    const lines = [
      '+    "node_modules/acme": {',
      '+      "version": "1.0.0",',
      '+      "dependencies": {',
      '+        "propagate": "^2.0.0"',
      '+      }',
      '+    },',
      '+    "node_modules/propagate": {',
      '+      "version": "2.0.1"',
      '+    },',
    ];
    const lock = ({ lines: changed }: LockPatchParams) =>
      changeGateOf({
        rules: ACME,
        paths: ['package-lock.json'],
        patch: lockPatchOf({ path: 'package-lock.json', lines: changed }),
      });

    expect(lock({ lines })).toEqual({ kind: 'clear' });
    expect(
      lock({ lines: [...lines, '+    "node_modules/left-pad": {', '+      "version": "1.3.0"'] }),
    ).toEqual({
      kind: 'refused',
      paths: ['package-lock.json'],
    });
    expect(lock({ lines: ['+    "node_modules/acme": {', '+      "version": "9.0.0",'] })).toEqual({
      kind: 'refused',
      paths: ['package-lock.json'],
    });
  });

  it('reads a Cargo lock by its package blocks', () => {
    const block = ['+[[package]]', '+name = "acme"', '+version = "1.0.0"'];
    const other = ['+[[package]]', '+name = "northwind"', '+version = "9.0.0"'];
    const lock = ({ lines }: LockPatchParams) =>
      changeGateOf({
        rules: ACME,
        paths: ['Cargo.lock'],
        patch: lockPatchOf({ path: 'Cargo.lock', lines }),
      });

    expect(lock({ lines: block })).toEqual({ kind: 'clear' });
    expect(lock({ lines: [...block, ...other] })).toEqual({
      kind: 'refused',
      paths: ['Cargo.lock'],
    });
  });
});

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
      expect(changeGateOf({ rules: ALLOWED, paths, patch })).toEqual({
        kind: 'refused',
        paths: ['package.json'],
      });
    }
  });

  it('holds a lockfile entry the allowance does not name', () => {
    expect(
      changeGateOf({
        rules: ALLOWED,
        paths: ['pnpm-lock.yaml'],
        patch: lockPatchOf({ lines: ['-  left-pad@1.0.0:', '+  left-pad@1.3.0:'] }),
      }),
    ).toEqual({ kind: 'refused', paths: ['pnpm-lock.yaml'] });
    expect(
      changeGateOf({ rules: ALLOWED, paths: ['pnpm-lock.yaml'], patch: patchOf({ manifest: [] }) }),
    ).toEqual({ kind: 'clear' });
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
