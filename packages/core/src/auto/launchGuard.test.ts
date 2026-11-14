import { describe, expect, it } from 'vitest';
import { parseChildClosing } from './closing';
import { launchGuardBriefOf } from './kickoff';
import {
  DEPENDENCY_FILES,
  OFFLINE_PACKAGE_MANAGERS,
  PACKAGE_MANAGERS,
  PROTECTED_FILE_PATTERNS,
  isPathInPattern,
  launchGuardOf,
  launchGuardRulesOf,
  needSubjectOf,
  parseLaunchGuard,
  storedLaunchGuardOf,
  type LaunchGuard,
} from './launchGuard';

const ASK_BOTH: LaunchGuard = {
  dependencies: 'ask',
  protectedFiles: 'ask',
  allowedPackages: [],
  allowedPaths: [],
};

const askRules = () => {
  const rules = launchGuardRulesOf({ guard: ASK_BOTH });
  if (rules === null) {
    throw new Error('rules were expected');
  }
  return rules;
};

describe('the launch guard', () => {
  it('has no guard when both rows allow, so the launch is as today', () => {
    expect(
      launchGuardOf({ rows: { dependencies: 'allow', protectedFiles: 'allow' }, allowances: [] }),
    ).toBeNull();
    expect(
      launchGuardRulesOf({
        guard: { ...ASK_BOTH, dependencies: 'allow', protectedFiles: 'allow' },
      }),
    ).toBeNull();
  });

  it('adds the deny rules, the offline settings and the network off when the rows ask', () => {
    const rules = askRules();

    expect(rules.isNetworkOff).toBe(true);
    for (const file of DEPENDENCY_FILES) {
      expect(rules.deniedTools).toContain(`Edit(**/${file})`);
    }
    for (const pattern of PROTECTED_FILE_PATTERNS) {
      expect(rules.deniedTools).toContain(`Write(${pattern})`);
    }
    expect(rules.deniedTools).toContain('Bash(npm install *)');
    expect(rules.deniedTools).not.toContain('Bash(npm install:*)');
  });

  it.each(PACKAGE_MANAGERS.map((manager) => [manager.name, manager] as const))(
    'guards %s at launch',
    (_name, manager) => {
      const rules = askRules();
      for (const command of manager.adds) {
        expect(rules.deniedTools).toContain(`Bash(${command}:*)`);
        expect(rules.deniedTools).toContain(`Bash(${command} *)`);
      }
      for (const command of manager.installs) {
        expect(rules.deniedTools).toContain(`Bash(${command} *)`);
      }
      for (const file of [...manager.manifests, ...manager.lockfiles]) {
        expect(rules.deniedTools).toContain(`Edit(**/${file})`);
      }
      for (const [name, value] of manager.env) {
        expect(rules.env).toContainEqual({ name, value });
      }
      expect(OFFLINE_PACKAGE_MANAGERS.includes(manager.name)).toBe(manager.env.length > 0);
    },
  );

  it('lifts the dependency rules for an allowed package and keeps the protected ones', () => {
    const guard = launchGuardOf({
      rows: { dependencies: 'ask', protectedFiles: 'ask' },
      allowances: [{ kind: 'dependency', subject: 'nock@14.0.1' }],
    });
    const rules = guard === null ? null : launchGuardRulesOf({ guard });

    expect(guard?.allowedPackages).toEqual(['nock@14.0.1']);
    expect(rules?.isNetworkOff).toBe(false);
    expect(rules?.env).toEqual([]);
    expect(rules?.deniedTools).toContain('Edit(CODEOWNERS)');
    expect(rules?.deniedTools).not.toContain('Edit(**/package.json)');
    expect(rules?.deniedTools).not.toContain('Bash(pnpm add *)');
    expect(rules?.deniedTools).toContain('Edit(**/pnpm-lock.yaml)');
  });

  it('keeps no dependency allowance once the row allows every dependency', () => {
    const guard = launchGuardOf({
      rows: { dependencies: 'allow', protectedFiles: 'ask' },
      allowances: [{ kind: 'dependency', subject: 'nock@14.0.1' }],
    });

    expect(guard?.allowedPackages).toEqual([]);
    expect(guard === null ? null : launchGuardRulesOf({ guard })?.deniedTools).not.toContain(
      'Edit(**/pnpm-lock.yaml)',
    );
  });

  it('lifts only the pattern that holds an allowed protected path', () => {
    const guard = launchGuardOf({
      rows: { dependencies: 'allow', protectedFiles: 'ask' },
      allowances: [{ kind: 'protected_file', subject: '.github/workflows/ci.yml' }],
    });
    const rules = guard === null ? null : launchGuardRulesOf({ guard });

    expect(rules?.deniedTools).not.toContain('Edit(.github/workflows/**)');
    expect(rules?.deniedTools).toContain('Edit(.husky/**)');
    expect(rules?.isNetworkOff).toBe(false);
  });

  it('reads a stored guard back and refuses a broken one', () => {
    expect(storedLaunchGuardOf({ writeSet: { worktreePath: '/w', guard: ASK_BOTH } })).toEqual(
      ASK_BOTH,
    );
    expect(storedLaunchGuardOf({ writeSet: { worktreePath: '/w' } })).toBeNull();
    expect(parseLaunchGuard({ value: { ...ASK_BOTH, dependencies: 'maybe' } })).toBeNull();
  });

  it('matches a protected path by its folder or its exact name', () => {
    expect(
      isPathInPattern({ pattern: '.github/workflows/**', path: './.github/workflows/a.yml' }),
    ).toBe(true);
    expect(isPathInPattern({ pattern: 'CODEOWNERS', path: 'docs/CODEOWNERS' })).toBe(false);
    expect(isPathInPattern({ pattern: '.husky/**', path: '.huskyrc' })).toBe(false);
  });

  it('reads the package, the version or the path from the line the agent wrote', () => {
    expect(needSubjectOf({ kind: 'dependency', request: 'nock 14.0.1: stubs the host' })).toBe(
      'nock@14.0.1',
    );
    expect(
      needSubjectOf({ kind: 'dependency', request: '`@acme/ledger-core` 2.1.0 for types' }),
    ).toBe('@acme/ledger-core@2.1.0');
    expect(needSubjectOf({ kind: 'dependency', request: 'nock@14.0.1: stubs the host' })).toBe(
      'nock@14.0.1',
    );
    expect(needSubjectOf({ kind: 'dependency', request: 'nock for the host' })).toBe('nock');
    expect(
      needSubjectOf({ kind: 'protected_file', request: '.github/workflows/ci.yml: a new job' }),
    ).toBe('.github/workflows/ci.yml');
    expect(needSubjectOf({ kind: 'dependency', request: '   ' })).toBeNull();
  });

  it('parses a dependency and a protected file need from the closing line', () => {
    const closing = parseChildClosing({
      text: 'Stopped.\n<<step-done id="agent-1" status="returned" needs="dependency">>\nnock 14.0.1: stubs the host',
      childAgentId: 'agent-1',
    });
    expect(closing.returned).toEqual({
      needs: { kind: 'dependency' },
      request: 'nock 14.0.1: stubs the host',
    });
    const file = parseChildClosing({
      text: 'Stopped.\n<<step-done id="agent-1" status="returned" needs="protected_file">>\nCODEOWNERS: add the team',
      childAgentId: 'agent-1',
    });
    expect(file.returned?.needs).toEqual({ kind: 'protected_file' });
  });

  it('tells the agent to stop and name its need, and what one allowance lets it do', () => {
    const brief = launchGuardBriefOf({ guard: ASK_BOTH, childAgentId: 'agent-1' }) ?? '';
    expect(brief).toContain('needs="dependency"');
    expect(brief).toContain('needs="protected_file"');

    const allowed =
      launchGuardBriefOf({
        guard: { ...ASK_BOTH, dependencies: 'allow', allowedPackages: ['nock@14.0.1'] },
        childAgentId: 'agent-1',
      }) ?? '';
    expect(allowed).not.toContain('needs="dependency"');
    expect(allowed).toContain('You may add nock@14.0.1');
    expect(
      launchGuardBriefOf({
        guard: { ...ASK_BOTH, dependencies: 'allow', protectedFiles: 'allow' },
        childAgentId: 'agent-1',
      }),
    ).toBeNull();
  });
});
