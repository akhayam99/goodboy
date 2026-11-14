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

describe('the landing backstop', () => {
  it('is off when both rows allow, whatever changed', () => {
    expect(isChangeGateOn({ rules: ALLOW_BOTH })).toBe(false);
    expect(changeGateOf({ rules: ALLOW_BOTH, paths: ['pnpm-lock.yaml', 'CODEOWNERS'] })).toEqual({
      kind: 'clear',
    });
    expect(changeGateOf({ rules: ALLOW_BOTH, paths: null })).toEqual({ kind: 'clear' });
  });

  it('refuses a manifest or a lockfile in any folder while the dependency row asks', () => {
    expect(
      changeGateOf({
        rules: ASK_BOTH,
        paths: ['src/retry.ts', 'packages/ledger-core/package.json', 'Cargo.lock'],
      }),
    ).toEqual({ kind: 'refused', paths: ['packages/ledger-core/package.json', 'Cargo.lock'] });
  });

  it('refuses a protected file the guard did not allow', () => {
    expect(
      changeGateOf({
        rules: { rows: { dependencies: 'allow', protectedFiles: 'ask' }, guard: null },
        paths: ['./.github/workflows/ci.yml', 'package.json'],
      }),
    ).toEqual({ kind: 'refused', paths: ['.github/workflows/ci.yml'] });
  });

  it('lets a change through that an allowance of the attempt covers', () => {
    const guard: LaunchGuard = {
      ...GUARD,
      dependencies: 'allow',
      allowedPackages: ['nock@14.0.1'],
      allowedPaths: ['.github/workflows/ci.yml'],
    };

    expect(
      changeGateOf({
        rules: { ...ASK_BOTH, guard },
        paths: ['pnpm-lock.yaml', 'package.json', '.github/workflows/ci.yml'],
      }),
    ).toEqual({ kind: 'clear' });
    expect(
      changeGateOf({ rules: { ...ASK_BOTH, guard }, paths: ['.github/workflows/release.yml'] }),
    ).toEqual({ kind: 'refused', paths: ['.github/workflows/release.yml'] });
  });

  it('refuses when the changed files could not be read', () => {
    expect(changeGateOf({ rules: ASK_BOTH, paths: null })).toEqual({ kind: 'unread' });
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
