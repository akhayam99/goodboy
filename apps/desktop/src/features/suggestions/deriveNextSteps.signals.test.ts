// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type AgentId,
  type MountId,
  type ProjectId,
  type PullRequestState,
  type SessionEventId,
  type SessionId,
} from '@goodboy/types';
import { deriveNextSteps, type SuggestionMount } from './deriveNextSteps';
import type { NextStepSignals, SignalCheckLog } from './nextStepSignals';
import type { SuggestionMountEvent } from '../../store/slices/project-mounts/materializationProposals';
import { discoveredScriptId, type ScriptGroup } from '../scripts/scripts';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });
const LEDGER = brandId<ProjectId>({ value: 'project-ledger-core' });
const LEDGER_MOUNT = brandId<MountId>({ value: 'mount-ledger-core' });
const NOTIFY = brandId<ProjectId>({ value: 'project-notify-relay' });
const NOTIFY_MOUNT = brandId<MountId>({ value: 'mount-notify-relay' });
const AGENT = brandId<AgentId>({ value: 'agent-implementer' });
const NOW = Date.parse('2026-11-21T10:00:00.000Z');
const JOB = 'https://github.com/acme/ledger-core/actions/runs/9001/job/42';
const MIN = 60_000;
const DAY = 86_400_000;

const BASE: NextStepSignals = {
  sessionId: SESSION,
  workflowRuns: [],
  plans: [],
  consumedPlanIds: new Set(),
  openQuestionCount: 0,
  hasPullRequest: false,
  eligibleThreadCount: 0,
  mountEvents: [],
  projects: [],
  now: () => NOW,
};

const pr = (overrides: Partial<PullRequestState> = {}): PullRequestState => ({
  number: 418,
  title: 'Round ledger totals',
  url: 'https://github.com/acme/ledger-core/pull/418',
  state: 'open',
  mergeable: true,
  checks: 'failure',
  baseBranch: 'main',
  headBranch: 'feature/rounding',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: '2026-11-21T09:58:00.000Z',
  ...overrides,
});

const mount = (overrides: Partial<SuggestionMount> = {}): SuggestionMount => ({
  mountId: LEDGER_MOUNT,
  projectId: LEDGER,
  projectName: 'ledger-core',
  branch: 'feature/rounding',
  worktreePath: '/work/ledger-core',
  push: null,
  aheadOfBase: null,
  isClean: true,
  pr: pr(),
  fetchedAt: '2026-11-21T09:58:00.000Z',
  failedChecks: [{ name: 'integration-tests', detailsUrl: JOB }],
  ...overrides,
});

const log = (overrides: Partial<SignalCheckLog> = {}): SignalCheckLog => ({
  detailsUrl: JOB,
  status: 'ready',
  fetchedAt: '2026-11-21T09:58:30.000Z',
  testFile: 'src/ledger/rounding.test.ts',
  testName: null,
  isTimeout: false,
  lines: ['FAIL src/ledger/rounding.test.ts', 'expected 10.01 to equal 10.00'],
  ...overrides,
});

const scriptGroup = (names: ReadonlyArray<string>): ScriptGroup => ({
  source: 'package-json',
  packageName: 'ledger-core',
  relDir: '',
  manager: 'pnpm',
  scripts: names.map((name) => ({ name, command: `pnpm run ${name}`, body: name })),
});

const testGroup: ScriptGroup = {
  ...scriptGroup([]),
  scripts: [{ name: 'test', command: 'pnpm test', body: 'vitest run' }],
};

const kindsOf = (signals: NextStepSignals) => deriveNextSteps({ signals }).map((move) => move.kind);

const moveOfKind = <K extends string>({
  signals,
  kind,
}: {
  readonly signals: NextStepSignals;
  readonly kind: K;
}) => deriveNextSteps({ signals }).find((move) => move.kind === kind);

describe('run-failing-test', () => {
  const signals: NextStepSignals = {
    ...BASE,
    mounts: [mount()],
    checkLogs: [log()],
    scripts: [{ mountId: LEDGER_MOUNT, worktreePath: '/work/ledger-core', groups: [testGroup] }],
  };

  it('names the test and writes the command for the user, who presses Enter', () => {
    const move = moveOfKind({ signals, kind: 'run-failing-test' });
    expect(move?.kind === 'run-failing-test' ? move.payload.command : null).toEqual({
      text: 'pnpm test src/ledger/rounding.test.ts',
      cwd: '/work/ledger-core',
      mode: 'type',
      scriptId: null,
    });
    expect(move?.reason).toBe('integration-tests failed in src/ledger/rounding.test.ts');
    expect(move?.place).toEqual({ tool: 'terminal', mountId: LEDGER_MOUNT, agentId: null });
    expect(move?.completesWhen).toEqual({
      kind: 'check-passes',
      mountId: LEDGER_MOUNT,
      checkName: 'integration-tests',
    });
    expect(move?.evidence.map((item) => item.kind)).toEqual(['log', 'command']);
  });

  it('quotes a test name that came from a log so it cannot end the command', () => {
    const hostile = log({ testFile: null, testName: "x'; rm -rf ~; echo '" });
    const move = moveOfKind({
      signals: { ...signals, checkLogs: [hostile] },
      kind: 'run-failing-test',
    });
    expect(move?.kind === 'run-failing-test' ? move.payload.command.text : '').toBe(
      "pnpm test 'x'\\''; rm -rf ~; echo '\\'''",
    );
  });

  it('says nothing when the project has no test script or the log names no test', () => {
    expect(kindsOf({ ...signals, scripts: [] })).not.toContain('run-failing-test');
    expect(kindsOf({ ...signals, checkLogs: [log({ testFile: null })] })).not.toContain(
      'run-failing-test',
    );
    expect(kindsOf({ ...signals, checkLogs: [log({ status: 'none' })] })).not.toContain(
      'run-failing-test',
    );
  });

  it('says Open on and the host for a check outside GitHub Actions, never a log', () => {
    const external = 'https://ci.harborline.dev/builds/77';
    const move = moveOfKind({
      signals: {
        ...BASE,
        mounts: [mount({ failedChecks: [{ name: 'lint', detailsUrl: external }] })],
      },
      kind: 'fix-checks',
    });
    expect(move?.evidence).toEqual([
      { kind: 'link', label: 'Open on ci.harborline.dev', url: external },
    ]);
  });
});

describe('next-script', () => {
  const migrateId = discoveredScriptId({
    worktreePath: '/work/ledger-core',
    source: 'package-json',
    relDir: '',
    name: 'db:migrate',
  });
  const turn = (paths: ReadonlyArray<string>) => [
    { mountId: LEDGER_MOUNT, paths, recordedAtMs: NOW - 5 * MIN },
  ];
  const withScripts = (names: ReadonlyArray<string>): NextStepSignals => ({
    ...BASE,
    mounts: [mount({ pr: null, failedChecks: [] })],
    scripts: [
      { mountId: LEDGER_MOUNT, worktreePath: '/work/ledger-core', groups: [scriptGroup(names)] },
    ],
  });

  it('writes a destructive migration for the user to confirm with Enter', () => {
    const move = moveOfKind({
      signals: {
        ...withScripts(['db:migrate']),
        turnFiles: turn(['migrations/0042_add_ledger_index.sql']),
      },
      kind: 'next-script',
    });
    expect(move?.title).toBe('Run db:migrate');
    expect(move?.reason).toBe(
      'A migration changed in the last turn · migrations/0042_add_ledger_index.sql',
    );
    expect(move?.kind === 'next-script' ? move.payload.command.mode : null).toBe('type');
    expect(move?.place.tool).toBe('terminal');
    expect(move?.completesWhen).toEqual({
      kind: 'script-succeeds',
      scriptId: migrateId,
      scriptName: 'db:migrate',
      sinceMs: NOW - 5 * MIN,
    });
  });

  it('runs a safe script on the click, in the scripts tool', () => {
    const move = moveOfKind({
      signals: {
        ...withScripts(['db:generate']),
        turnFiles: turn(['prisma/schema.prisma']),
      },
      kind: 'next-script',
    });
    expect(move?.kind === 'next-script' ? move.payload.command.mode : null).toBe('run');
    expect(move?.place.tool).toBe('scripts');
  });

  it('offers an install for a changed lockfile with the package manager of the project', () => {
    const move = moveOfKind({
      signals: { ...withScripts(['build']), turnFiles: turn(['pnpm-lock.yaml']) },
      kind: 'next-script',
    });
    expect(move?.title).toBe('Install dependencies');
    expect(move?.kind === 'next-script' ? move.payload.command.text : '').toBe('pnpm install');
  });

  it('stops offering the script once it ran fine after the turn', () => {
    const signals: NextStepSignals = {
      ...withScripts(['db:migrate']),
      turnFiles: turn(['migrations/0042_add_ledger_index.sql']),
    };
    expect(kindsOf(signals)).toContain('next-script');
    expect(
      kindsOf({
        ...signals,
        scriptRuns: [
          {
            scriptId: migrateId,
            mountId: LEDGER_MOUNT,
            name: 'db:migrate',
            isOk: true,
            completedAt: NOW,
          },
        ],
      }),
    ).not.toContain('next-script');
    expect(
      kindsOf({
        ...signals,
        scriptRuns: [
          {
            scriptId: migrateId,
            mountId: LEDGER_MOUNT,
            name: 'db:migrate',
            isOk: false,
            completedAt: NOW,
          },
        ],
      }),
    ).toContain('next-script');
  });

  it('offers nothing when no rule fires or the project has no such script', () => {
    expect(
      kindsOf({ ...withScripts(['db:migrate']), turnFiles: turn(['src/index.ts']) }),
    ).not.toContain('next-script');
    expect(
      kindsOf({ ...withScripts(['build']), turnFiles: turn(['migrations/0042_add.sql']) }),
    ).not.toContain('next-script');
  });
});

describe('rerun-check', () => {
  const signals: NextStepSignals = {
    ...BASE,
    mounts: [mount()],
    checkLogs: [log({ testFile: null, isTimeout: true })],
  };

  it('offers Rerun when the log says the job timed out', () => {
    const move = moveOfKind({ signals, kind: 'rerun-check' });
    expect(move?.title).toBe('Rerun integration-tests');
    expect(move?.reason).toBe('integration-tests timed out on #418, as the job log says');
    expect(move?.kind === 'rerun-check' ? move.payload.runId : null).toBe('9001');
    expect(move?.place).toEqual({ tool: 'checks', mountId: LEDGER_MOUNT, agentId: null });
  });

  it('takes the place of Fix checks for the same pull request', () => {
    expect(kindsOf(signals)).toEqual(['rerun-check']);
  });

  it('never claims a timeout without a log, and never for a check outside Actions', () => {
    expect(kindsOf({ ...signals, checkLogs: [] })).toEqual(['fix-checks']);
    expect(
      kindsOf({
        ...signals,
        mounts: [
          mount({ failedChecks: [{ name: 'lint', detailsUrl: 'https://ci.harborline.dev/1' }] }),
        ],
      }),
    ).toEqual(['fix-checks']);
  });
});

describe('unmount-folder and close-worktree', () => {
  const idle = (overrides = {}) => ({
    mountId: NOTIFY_MOUNT,
    projectId: NOTIFY,
    projectName: 'notify-relay',
    branch: 'feature/relay',
    isRepo: false,
    isClean: true,
    hasUnpushedWork: false,
    hasOpenPr: false,
    lastTouchedMs: NOW - 9 * DAY,
    requestId: 'cleanup:unmount:mount-notify-relay:feature/relay',
    isProposed: false,
    ...overrides,
  });

  it('offers Unmount for a plain folder no turn touched for seven days', () => {
    const move = moveOfKind({ signals: { ...BASE, idleMounts: [idle()] }, kind: 'unmount-folder' });
    expect(move?.title).toBe('Remove notify-relay from this session');
    expect(move?.reason).toBe('No turn touched it for 9 days');
    expect(move?.completesWhen).toEqual({ kind: 'folder-unmounted', mountId: NOTIFY_MOUNT });
  });

  it('waits the full seven days, and never guesses when no turn was ever recorded', () => {
    expect(kindsOf({ ...BASE, idleMounts: [idle({ lastTouchedMs: NOW - 6 * DAY })] })).toEqual([]);
    expect(kindsOf({ ...BASE, idleMounts: [idle({ lastTouchedMs: null })] })).toEqual([]);
  });

  it('offers a worktree for removal after seven idle days only when nothing is lost', () => {
    const repo = idle({ isRepo: true });
    expect(kindsOf({ ...BASE, idleMounts: [repo] })).toEqual(['close-worktree']);
    expect(kindsOf({ ...BASE, idleMounts: [{ ...repo, hasUnpushedWork: true }] })).toEqual([]);
    expect(kindsOf({ ...BASE, idleMounts: [{ ...repo, isClean: false }] })).toEqual([]);
    expect(kindsOf({ ...BASE, idleMounts: [{ ...repo, hasOpenPr: true }] })).toEqual([]);
  });

  it('reads a merged pull request at once, with the age of the merge', () => {
    const move = moveOfKind({
      signals: {
        ...BASE,
        mergedMounts: [
          {
            mountId: LEDGER_MOUNT,
            projectName: 'ledger-core',
            branch: 'feature/rounding',
            prNumber: 418,
            mergedAt: new Date(NOW - 3 * DAY).toISOString(),
            requestId: 'cleanup:merge_cleanup:mount-ledger-core:feature/rounding',
            isProposed: false,
          },
        ],
      },
      kind: 'close-worktree',
    });
    expect(move?.title).toBe('Remove the ledger-core worktree');
    expect(move?.reason).toBe('#418 merged 3d ago');
    expect(move?.completesWhen).toEqual({ kind: 'worktree-removed', mountId: LEDGER_MOUNT });
  });

  it('shows one maintenance move, and only when nothing else is left', () => {
    const maintenance = {
      ...BASE,
      idleMounts: [
        idle(),
        idle({ mountId: LEDGER_MOUNT, projectName: 'ledger-core', projectId: LEDGER }),
      ],
    };
    expect(kindsOf(maintenance)).toHaveLength(1);
    expect(kindsOf({ ...maintenance, openQuestionCount: 1 })).toEqual(['answer-questions']);
  });
});

describe('ask-agent', () => {
  const quiet = (quietMs: number) => ({
    ...BASE,
    quietAgents: [{ agentId: AGENT, label: 'Implementer', quietMs }],
  });

  it('asks an agent quiet for five minutes what blocks it', () => {
    const move = moveOfKind({ signals: quiet(5 * MIN), kind: 'ask-agent' });
    expect(move?.title).toBe('Ask the Implementer what blocks it');
    expect(move?.reason).toBe('Quiet for 5 minutes');
    expect(move?.place).toEqual({ tool: 'agent', mountId: null, agentId: AGENT });
    expect(move?.evidence).toEqual([{ kind: 'quiet', label: 'Quiet', quietMs: 5 * MIN }]);
  });

  it('stays out before five minutes and hands over to Needs you at thirty', () => {
    expect(kindsOf(quiet(4 * MIN))).toEqual([]);
    expect(kindsOf(quiet(29 * MIN))).toEqual(['ask-agent']);
    expect(kindsOf(quiet(30 * MIN))).toEqual([]);
  });
});

describe('mount-project asked again', () => {
  const event = (id: string): SuggestionMountEvent => ({
    eventId: brandId<SessionEventId>({ value: id }),
    kind: 'proposed',
    projectId: NOTIFY,
    projectName: 'notify-relay',
    reason: 'needs the relay client',
    agentId: AGENT,
    turnRunId: null,
    cause: 'scope',
    hasRecordedReason: true,
  });

  it('says an agent asked twice and moves the proposal up', () => {
    const once = moveOfKind({
      signals: { ...BASE, mountEvents: [event('e1')] },
      kind: 'mount-project',
    });
    const twice = moveOfKind({
      signals: { ...BASE, mountEvents: [event('e1'), event('e2')] },
      kind: 'mount-project',
    });
    expect(once?.reason).toBe('needs the relay client');
    expect(twice?.reason).toBe('needs the relay client · asked 2 times');
    expect(twice?.priority).toBeLessThan(once?.priority ?? 0);
    expect(twice?.completesWhen).toEqual({ kind: 'folder-mounted', projectId: NOTIFY });
  });
});

describe('a stale or missing read', () => {
  it('keeps Fix checks and says how old the read is', () => {
    const move = moveOfKind({
      signals: { ...BASE, mounts: [mount({ fetchedAt: '2026-11-21T09:48:00.000Z' })] },
      kind: 'fix-checks',
    });
    expect(move?.read).toEqual({ state: 'stale', fetchedAt: '2026-11-21T09:48:00.000Z' });
  });

  it('does not count a pull request that was never read as fresh', () => {
    const move = moveOfKind({
      signals: { ...BASE, mounts: [mount({ fetchedAt: null })] },
      kind: 'fix-checks',
    });
    expect(move?.read).toEqual({ state: 'unread', fetchedAt: null });
  });

  it('marks a recent read fresh, and leaves kinds with no pull request read alone', () => {
    const fresh = moveOfKind({ signals: { ...BASE, mounts: [mount()] }, kind: 'fix-checks' });
    expect(fresh?.read?.state).toBe('fresh');
    const asked = moveOfKind({
      signals: {
        ...BASE,
        quietAgents: [{ agentId: AGENT, label: 'Implementer', quietMs: 6 * MIN }],
      },
      kind: 'ask-agent',
    });
    expect(asked?.read).toBeNull();
  });
});

describe('order and reasons', () => {
  const stopped = {
    id: 'mount:mount-ledger-core',
    mountId: LEDGER_MOUNT,
    projectId: LEDGER,
    projectName: 'ledger-core',
    branch: 'feature/rounding',
    worktreePath: '/work/ledger-core',
    baseBranch: 'main',
    mainDistance: 0,
    rebaseStop: { conflicts: 3 },
  };

  it('puts a stopped rebase above Rerun', () => {
    const kinds = kindsOf({
      ...BASE,
      projects: [stopped],
      mounts: [mount()],
      checkLogs: [log({ testFile: null, isTimeout: true })],
    });
    expect(kinds).toEqual(['rebase-project', 'rerun-check']);
  });

  it('says how many files hold the conflict when a rebase stopped', () => {
    const move = moveOfKind({ signals: { ...BASE, projects: [stopped] }, kind: 'rebase-project' });
    expect(move?.title).toBe('Finish the rebase on ledger-core');
    expect(move?.reason).toBe('Rebase stopped, 3 files have conflicts');
    expect(move?.completesWhen).toEqual({ kind: 'rebase-finished', mountId: LEDGER_MOUNT });
    expect(move?.group).toBe('unblock');
  });

  it('keeps unblocking moves before moves that carry on', () => {
    const moves = deriveNextSteps({
      signals: {
        ...BASE,
        openQuestionCount: 1,
        mounts: [mount()],
        checkLogs: [log()],
        scripts: [
          { mountId: LEDGER_MOUNT, worktreePath: '/work/ledger-core', groups: [testGroup] },
        ],
      },
    });
    expect(moves.map((move) => move.group)).toEqual(['unblock', 'unblock', 'advance']);
    expect(moves.map((move) => move.kind)).toEqual([
      'answer-questions',
      'fix-checks',
      'run-failing-test',
    ]);
  });

  it('gives every move a reason in words, so none shows without one', () => {
    const moves = deriveNextSteps({
      signals: {
        ...BASE,
        openQuestionCount: 2,
        mounts: [mount()],
        checkLogs: [log()],
        scripts: [
          { mountId: LEDGER_MOUNT, worktreePath: '/work/ledger-core', groups: [testGroup] },
        ],
        quietAgents: [{ agentId: AGENT, label: 'Implementer', quietMs: 7 * MIN }],
        projects: [stopped],
      },
    });
    expect(moves.length).toBeGreaterThan(3);
    for (const move of moves) {
      expect(move.reason.trim()).not.toBe('');
    }
  });
});

describe('a session that is not on screen', () => {
  it('derives its moves from signals alone, with no mounted view', () => {
    const other = brandId<SessionId>({ value: 'session-northwind' });
    const moves = deriveNextSteps({
      signals: {
        ...BASE,
        sessionId: other,
        mounts: [mount()],
        checkLogs: [log({ testFile: null, isTimeout: true })],
      },
    });
    expect(moves.map((move) => move.kind)).toEqual(['rerun-check']);
    expect(moves.every((move) => move.sessionId === other)).toBe(true);
  });
});

describe('the check a move names', () => {
  const second = 'https://github.com/acme/ledger-core/actions/runs/9001/job/43';
  const twoChecks = [
    { name: 'lint', detailsUrl: JOB },
    { name: 'integration-tests', detailsUrl: second },
  ];

  it('shows the log and link of the failing check the move is about, not the first one', () => {
    const logs = [
      log({ detailsUrl: JOB, isTimeout: false, lines: ['lint: unused import'] }),
      log({
        detailsUrl: second,
        isTimeout: true,
        lines: ['integration-tests: timed out after 60s'],
      }),
    ];
    const move = moveOfKind({
      signals: {
        ...BASE,
        mounts: [mount({ failedChecks: twoChecks })],
        checkLogs: logs,
      },
      kind: 'rerun-check',
    });
    expect(move?.evidence).toEqual([
      { kind: 'log', label: 'Log', lines: ['integration-tests: timed out after 60s'] },
    ]);
  });

  it('keeps the first failing check for the generic Fix checks move', () => {
    const move = moveOfKind({
      signals: {
        ...BASE,
        mounts: [mount({ failedChecks: twoChecks })],
        checkLogs: [log({ detailsUrl: JOB, lines: ['lint: unused import'] })],
      },
      kind: 'fix-checks',
    });
    expect(move?.evidence).toEqual([{ kind: 'log', label: 'Log', lines: ['lint: unused import'] }]);
  });

  it('shows the link of the named check when it runs outside GitHub Actions', () => {
    const external = 'https://ci.harborline.dev/builds/77';
    const move = moveOfKind({
      signals: {
        ...BASE,
        mounts: [
          mount({
            failedChecks: [
              { name: 'lint', detailsUrl: JOB },
              { name: 'integration-tests', detailsUrl: external },
            ],
          }),
        ],
        checkLogs: [log({ detailsUrl: JOB })],
      },
      kind: 'fix-checks',
    });
    expect(move?.evidence.map((item) => item.kind)).toEqual(['log']);
  });
});

describe('scripts of a nested package', () => {
  const apiGroup: ScriptGroup = {
    source: 'package-json',
    packageName: 'ledger-api',
    relDir: 'packages/api',
    manager: 'pnpm',
    scripts: [
      { name: 'db:migrate', command: 'pnpm run db:migrate', body: 'x' },
      { name: 'test', command: 'pnpm test', body: 'vitest run' },
    ],
  };
  const rootGroup: ScriptGroup = {
    ...scriptGroup([]),
    scripts: [
      { name: 'db:migrate', command: 'pnpm run db:migrate', body: 'y' },
      { name: 'test', command: 'pnpm test', body: 'vitest run' },
    ],
  };
  const scripts = [
    { mountId: LEDGER_MOUNT, worktreePath: '/work/ledger-core', groups: [rootGroup, apiGroup] },
  ];

  it('runs a migration from the package that owns the changed file, with that package as its identity', () => {
    const move = moveOfKind({
      signals: {
        ...BASE,
        mounts: [mount({ pr: null, failedChecks: [] })],
        scripts,
        turnFiles: [
          {
            mountId: LEDGER_MOUNT,
            paths: ['packages/api/migrations/0042_add_ledger_index.sql'],
            recordedAtMs: NOW - 5 * MIN,
          },
        ],
      },
      kind: 'next-script',
    });
    expect(move?.kind === 'next-script' ? move.payload.command.cwd : null).toBe(
      '/work/ledger-core/packages/api',
    );
    expect(move?.kind === 'next-script' ? move.payload.scriptId : null).toBe(
      discoveredScriptId({
        worktreePath: '/work/ledger-core',
        source: 'package-json',
        relDir: 'packages/api',
        name: 'db:migrate',
      }),
    );
  });

  it('gives two worktrees running the same script two different identities', () => {
    const moves = ['/work/ledger-core', '/work/ledger-core-b'].map((worktreePath, index) => {
      const mountId = index === 0 ? LEDGER_MOUNT : NOTIFY_MOUNT;
      return moveOfKind({
        signals: {
          ...BASE,
          mounts: [mount({ mountId, worktreePath, pr: null, failedChecks: [] })],
          scripts: [{ mountId, worktreePath, groups: [rootGroup] }],
          turnFiles: [
            { mountId, paths: ['migrations/0042_add_ledger_index.sql'], recordedAtMs: NOW - MIN },
          ],
        },
        kind: 'next-script',
      });
    });
    const ids = moves.map((move) => (move?.kind === 'next-script' ? move.payload.scriptId : null));
    expect(ids[0]).not.toBeNull();
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('offers nothing when the owning package has no such script, instead of running the root one', () => {
    const noScript: ScriptGroup = { ...apiGroup, scripts: [] };
    expect(
      kindsOf({
        ...BASE,
        mounts: [mount({ pr: null, failedChecks: [] })],
        scripts: [
          {
            mountId: LEDGER_MOUNT,
            worktreePath: '/work/ledger-core',
            groups: [rootGroup, noScript],
          },
        ],
        turnFiles: [
          {
            mountId: LEDGER_MOUNT,
            paths: ['packages/api/migrations/0042_add_ledger_index.sql'],
            recordedAtMs: NOW - MIN,
          },
        ],
      }),
    ).not.toContain('next-script');
  });

  it('types the failing test from the package of the test file, with a path relative to it', () => {
    const move = moveOfKind({
      signals: {
        ...BASE,
        mounts: [mount()],
        checkLogs: [log({ testFile: 'packages/api/src/ledger/rounding.test.ts' })],
        scripts,
      },
      kind: 'run-failing-test',
    });
    expect(move?.kind === 'run-failing-test' ? move.payload.command : null).toEqual({
      text: 'pnpm test src/ledger/rounding.test.ts',
      cwd: '/work/ledger-core/packages/api',
      mode: 'type',
      scriptId: null,
    });
  });

  it('falls back to the root test script for a test file outside every package', () => {
    const move = moveOfKind({
      signals: {
        ...BASE,
        mounts: [mount()],
        checkLogs: [log({ testFile: 'e2e/ledger.test.ts' })],
        scripts,
      },
      kind: 'run-failing-test',
    });
    expect(move?.kind === 'run-failing-test' ? move.payload.command.cwd : null).toBe(
      '/work/ledger-core',
    );
  });
});
