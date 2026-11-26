// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId } from '@goodboy/types';
import type {
  ContextSlot,
  IsoDateTime,
  MountId,
  MountPullRequestLink,
  PullRequestState,
  PullRequestView,
  Session,
  SessionId,
} from '@goodboy/types';
import { sessionMergeFacts } from '../../actions/kinds/pullRequestFacts';
import type { InboxRecord } from '../../inbox/types';
import { lineStatsOf } from './lineStatsOf';
import { pullRequestFieldsOf } from './pullRequestFieldsOf';
import { sessionGithubOf } from './sessionGithubOf';
import { SUMMARY_MAX, summaryOf } from './summaryOf';
import { TASK_DESCRIPTION_MAX, taskFactOf } from './taskFactOf';
import type { WorkspaceScope } from './workspaceScope';

const SESSION_ID = brandId<SessionId>({ value: 'session-ledger' });
const OBSERVED_AT = brandId<IsoDateTime>({ value: '2026-10-04T09:00:00.000Z' });

type RecordParams = {
  readonly payload: InboxRecord['payload'];
};

type LinearParams = {
  readonly description: string | null;
  readonly assignee: string | null;
};

const recordOf = ({ payload }: RecordParams): InboxRecord => ({
  key: 'record',
  provider: payload.provider,
  kind: 'issue',
  identifier: 'HBL-1',
  title: 'Close the ledger month',
  state: 'open',
  stateLabel: 'In Progress',
  updatedAt: '2026-10-04T09:00:00.000Z',
  url: 'https://linear.app/harborline/issue/HBL-1',
  context: 'Harborline',
  payload,
});

const linearRecord = ({ description, assignee }: LinearParams): InboxRecord =>
  recordOf({
    payload: {
      provider: 'linear',
      kind: 'issue',
      sessionId: null,
      issue: {
        id: 'lin-1',
        identifier: 'HBL-1',
        title: 'Close the ledger month',
        description,
        url: 'https://linear.app/harborline/issue/HBL-1',
        state: { name: 'In Progress', type: 'started' },
        team: { key: 'HBL' },
        assignee: assignee === null ? null : { name: assignee },
        updatedAt: OBSERVED_AT,
      },
    },
  });

describe('the task facts', () => {
  it('reads the description, the assignee and the tracker state a record holds', () => {
    const record = linearRecord({
      description: 'Round the ledger to cents.',
      assignee: 'Ada Northwind',
    });
    expect(taskFactOf({ record })).toEqual({
      description: 'Round the ledger to cents.',
      assignee: 'Ada Northwind',
      stateLabel: 'In Progress',
    });
  });

  it('caps the description and leaves a missing one absent', () => {
    const long = taskFactOf({
      record: linearRecord({ description: 'x'.repeat(TASK_DESCRIPTION_MAX * 3), assignee: null }),
    });
    expect(long.description?.length).toBe(TASK_DESCRIPTION_MAX);
    expect(long.assignee).toBeNull();
    const blank = taskFactOf({ record: linearRecord({ description: '   ', assignee: null }) });
    expect(blank.description).toBeNull();
    const none = taskFactOf({ record: linearRecord({ description: null, assignee: null }) });
    expect(none.description).toBeNull();
  });

  it('gives the display name of a Jira assignee, never an address', () => {
    const fact = taskFactOf({
      record: recordOf({
        payload: {
          provider: 'jira',
          kind: 'issue',
          sessionId: null,
          issue: {
            id: 'jira-1',
            key: 'HBL-2',
            summary: 'Close the ledger month',
            description: 'Round the ledger.',
            status: 'To Do',
            statusCategory: 'new',
            issueType: 'Task',
            priority: null,
            assignee: {
              accountId: 'acc-1',
              displayName: 'Grace Cascadia',
              emailAddress: 'grace@acme.test',
              avatarUrls: null,
              active: true,
            },
            reporter: null,
            labels: [],
            created: '2026-10-01T09:00:00.000Z',
            updated: '2026-10-04T09:00:00.000Z',
            url: 'https://acme.atlassian.net/browse/HBL-2',
          },
        },
      }),
    });
    expect(fact.assignee).toBe('Grace Cascadia');
    expect(JSON.stringify(fact)).not.toContain('acme.test');
  });
});

type SlotParams = {
  readonly value: string;
  readonly isEnabled: boolean;
};

const slotOf = ({ value, isEnabled }: SlotParams): ContextSlot => ({
  key: 'last_output_summary',
  value,
  enabled: isEnabled,
});

describe('the session summary', () => {
  it('reads the last output summary and caps it', () => {
    const short = slotOf({ value: 'Retries back off in three steps.', isEnabled: true });
    expect(summaryOf({ slots: [short] })).toBe('Retries back off in three steps.');
    const long = slotOf({ value: 'y'.repeat(SUMMARY_MAX * 2), isEnabled: true });
    expect(summaryOf({ slots: [long] })?.length).toBe(SUMMARY_MAX);
  });

  it('stays absent when the slot is missing, empty or turned off', () => {
    expect(summaryOf({ slots: undefined })).toBeNull();
    expect(summaryOf({ slots: [{ key: 'goal', value: 'x', enabled: true }] })).toBeNull();
    expect(summaryOf({ slots: [slotOf({ value: '   ', isEnabled: true })] })).toBeNull();
    expect(summaryOf({ slots: [slotOf({ value: 'Kept private', isEnabled: false })] })).toBeNull();
  });
});

type ViewParams = {
  readonly count: number;
  readonly stats: ReadonlyArray<readonly [number, number]>;
};

const viewOf = ({ count, stats }: ViewParams): PullRequestView =>
  Object.assign(Object.create(null), {
    files: {
      count,
      first: stats.map(([additions, deletions], index) => ({
        path: `src/file${index}.ts`,
        additions,
        deletions,
      })),
    },
  });

describe('the pull request line stats', () => {
  it('sums additions and deletions when every file is known', () => {
    const view = viewOf({
      count: 2,
      stats: [
        [10, 2],
        [5, 0],
      ],
    });
    expect(lineStatsOf({ view })).toEqual({ additions: 15, deletions: 2 });
  });

  it('stays absent, never zero, when only some files are known', () => {
    expect(lineStatsOf({ view: viewOf({ count: 120, stats: [[10, 2]] }) })).toBeNull();
    expect(lineStatsOf({ view: viewOf({ count: 0, stats: [] }) })).toBeNull();
    expect(lineStatsOf({ view: null })).toBeNull();
    expect(lineStatsOf({ view: undefined })).toBeNull();
  });
});

type PrParams = {
  readonly over?: Partial<PullRequestState>;
};

const prOf = ({ over = {} }: PrParams): PullRequestState => ({
  number: 41,
  title: 'Cascade the ledger rounding',
  url: 'https://github.com/harborline/ledger-core/pull/41',
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'goodboy/ledger-rounding',
  isDraft: false,
  reviewDecision: 'approved',
  body: '',
  updatedAt: '2026-10-04T09:00:00.000Z',
  headSha: 'abc1234',
  ...over,
});

type LinkParams = {
  readonly id: string;
  readonly state: MountPullRequestLink['state'];
  readonly snapshot: unknown;
};

const linkOf = ({ id, state, snapshot }: LinkParams) => ({
  sessionId: SESSION_ID,
  link: {
    id,
    mountId: brandId<MountId>({ value: 'mount-1' }),
    provider: 'github',
    host: 'github.com',
    repoSlug: 'harborline/ledger-core',
    prNumber: 41,
    headBranch: 'goodboy/ledger-rounding',
    baseBranch: 'main',
    url: 'https://github.com/harborline/ledger-core/pull/41',
    state,
    snapshot,
    lastObservedAt: OBSERVED_AT,
    createdAt: OBSERVED_AT,
    updatedAt: OBSERVED_AT,
  } satisfies MountPullRequestLink,
});

type ScopeParams = {
  readonly isOpen: boolean;
};

const scopeOf = ({ isOpen }: ScopeParams): WorkspaceScope => {
  const github = sessionGithubOf({
    links: [linkOf({ id: 'open', state: 'open', snapshot: prOf({}) })],
  })[SESSION_ID];
  return Object.assign(Object.create(null), {
    workspace: { id: 'ws-northwind', name: 'Northwind' },
    pullRequestFacts: {
      [SESSION_ID]: sessionMergeFacts({
        sessionId: SESSION_ID,
        github: github ?? null,
        threads: [],
      }),
    },
    fileCounts: {},
    lineStats: {},
    readyLines: [],
    mergeTrain: null,
    isOpen,
  });
};

const sessionOf = (): Session => Object.assign(Object.create(null), { id: SESSION_ID });

describe('the pull request facts of a workspace that is not open', () => {
  it('prefers an open request and ignores a snapshot that is not a request', () => {
    const github = sessionGithubOf({
      links: [
        linkOf({
          id: 'merged',
          state: 'merged',
          snapshot: prOf({ over: { number: 40, state: 'merged' } }),
        }),
        linkOf({ id: 'open', state: 'open', snapshot: prOf({}) }),
        linkOf({ id: 'broken', state: 'open', snapshot: { nothing: true } }),
      ],
    });
    expect(github[SESSION_ID]?.pr?.number).toBe(41);
    const broken = linkOf({ id: 'broken', state: 'open', snapshot: null });
    expect(sessionGithubOf({ links: [broken] })).toEqual({});
  });

  it('shows the request but offers no merge from a workspace the Mac has closed', () => {
    const fields = pullRequestFieldsOf({ scope: scopeOf({ isOpen: false }), session: sessionOf() });
    expect(fields).toMatchObject({
      number: 41,
      title: 'Cascade the ledger rounding',
      headBranch: 'goodboy/ledger-rounding',
      mergeActionId: null,
      additions: null,
      deletions: null,
      changedFiles: null,
    });
    expect(fields?.readiness).toMatchObject({
      isMergeable: false,
      reason: 'Open this workspace on your Mac to merge.',
    });
  });

  it('carries the line stats only when the scope knows them all', () => {
    const scope = {
      ...scopeOf({ isOpen: true }),
      lineStats: { [SESSION_ID]: { additions: 12, deletions: 3 } },
    };
    const known = pullRequestFieldsOf({ scope, session: sessionOf() });
    expect([known?.additions, known?.deletions]).toEqual([12, 3]);
    const unknown = pullRequestFieldsOf({ scope: scopeOf({ isOpen: true }), session: sessionOf() });
    expect([unknown?.additions, unknown?.deletions]).toEqual([null, null]);
  });
});
