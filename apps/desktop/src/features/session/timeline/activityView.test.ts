// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { anAgent } from '@goodboy/types/testing';
import type {
  Agent,
  AgentId,
  ArtifactId,
  IsoDateTime,
  OpenQuestion,
  OpenQuestionId,
  PlanId,
  PlanWithCount,
  ReportArtifact,
  SessionContextItem,
  SessionContextItemId,
  SessionEvent,
  SessionEventId,
  SessionExternalTask,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import type { SessionWorktree } from '@goodboy/db';
import { buildTimelineGroups } from './buildTimelineGroups';
import { entriesOfView, type ActivityView } from './activityView';
import { logEntriesMatching } from './logSearch';

const SESSION_ID = 'session-1' as SessionId;
const AT = '2026-10-03T10:00:00.000Z' as IsoDateTime;

const agent = ({ id, parentAgentId }: { readonly id: string; readonly parentAgentId?: string }) =>
  anAgent({
    id: id as AgentId,
    sessionId: SESSION_ID,
    name: `Agent ${id}`,
    status: 'completed',
    startedAt: AT,
    completedAt: AT,
    ...(parentAgentId === undefined ? {} : { parentAgentId: parentAgentId as AgentId }),
  });

const plan = ({
  id,
  agentId,
}: {
  readonly id: string;
  readonly agentId: string;
}): PlanWithCount => ({
  id: id as PlanId,
  sessionId: SESSION_ID,
  agentId: agentId as AgentId,
  title: `Plan ${id}`,
  bodyMd: '',
  status: 'active',
  createdAt: AT,
  updatedAt: AT,
  consumptionCount: 0,
});

const report = ({
  id,
  agentId,
}: {
  readonly id: string;
  readonly agentId: string;
}): ReportArtifact => ({
  id: id as ArtifactId,
  sessionId: SESSION_ID,
  agentId: agentId as AgentId,
  workflowRunId: null,
  kind: 'report',
  schemaVersion: 1,
  title: `Report ${id}`,
  sourceFormat: 'markdown',
  sourceText: '',
  metadata: { reportType: 'session' },
  status: 'active',
  revision: 1,
  sourceTurnId: null,
  createdAt: AT,
  updatedAt: AT,
  openedAt: null,
});

const learning = ({
  id,
  agentId,
}: {
  readonly id: string;
  readonly agentId: string;
}): SessionContextItem => ({
  id: id as SessionContextItemId,
  sessionId: SESSION_ID,
  workspaceId: 'workspace-1' as WorkspaceId,
  kind: 'learning',
  title: `Learning ${id}`,
  text: 'Retries share a delivery id',
  topic: null,
  source: { role: 'scout', agentId: agentId as AgentId, turnStart: 0, turnEnd: 1 },
  audience: [],
  status: 'active',
  createdAt: AT,
  projectName: null,
  isSessionDeleted: false,
  updatedAt: AT,
});

const question = ({
  id,
  status,
  createdByAgentId,
}: {
  readonly id: string;
  readonly status: OpenQuestion['status'];
  readonly createdByAgentId?: string;
}): OpenQuestion => ({
  id: id as OpenQuestionId,
  sessionId: SESSION_ID,
  text: `Which retry cap for ${id}?`,
  suggestedAnswers: [],
  isBlocking: false,
  userAnswer: status === 'answered' ? 'Three' : null,
  status,
  createdAt: AT,
  ...(status === 'answered' ? { answeredAt: AT } : {}),
  ...(createdByAgentId === undefined ? {} : { createdByAgentId: createdByAgentId as AgentId }),
});

const event = ({
  id,
  kind,
  payload = {},
  at = AT,
}: {
  readonly id: string;
  readonly kind: SessionEvent['kind'];
  readonly payload?: SessionEvent['payload'];
  readonly at?: IsoDateTime;
}): SessionEvent => ({
  id: id as SessionEventId,
  sessionId: SESSION_ID,
  kind,
  payload,
  createdAt: at,
});

type World = {
  readonly agents?: ReadonlyArray<Agent>;
  readonly plans?: ReadonlyArray<PlanWithCount>;
  readonly artifacts?: ReadonlyArray<ReportArtifact>;
  readonly learnings?: ReadonlyArray<SessionContextItem>;
  readonly questions?: ReadonlyArray<OpenQuestion>;
  readonly events?: ReadonlyArray<SessionEvent>;
  readonly externalTasks?: ReadonlyArray<SessionExternalTask>;
  readonly worktrees?: ReadonlyArray<SessionWorktree>;
};

const homesOf = ({
  world,
}: {
  readonly world: World;
}): ReadonlyMap<string, ActivityView | null> => {
  const events = world.events ?? [];
  const { entries } = buildTimelineGroups({
    sessionId: SESSION_ID,
    agents: world.agents ?? [],
    workflows: [],
    plans: world.plans ?? [],
    artifacts: world.artifacts ?? [],
    externalTasks: world.externalTasks ?? [],
    questions: world.questions ?? [],
    worktrees: world.worktrees ?? [],
    events,
    learnings: world.learnings ?? [],
    agentKindOverride: {},
  });
  const homes = new Map<string, ActivityView | null>();
  for (const entry of entries) {
    const home = (['activity', 'log'] as const).find(
      (view) => entriesOfView({ entries: [entry], events, view }).length === 1,
    );
    homes.set(entry.id, home ?? null);
  }
  return homes;
};

describe('the total partition of row kinds', () => {
  it('keeps a launch in Activity', () => {
    const homes = homesOf({ world: { agents: [agent({ id: 'scout' })] } });

    expect(homes.get('agent:scout')).toBe('activity');
  });

  it('keeps an output of a launch in Activity and one without a launch in the Log', () => {
    const homes = homesOf({
      world: {
        agents: [agent({ id: 'scout' })],
        plans: [
          plan({ id: 'with-launch', agentId: 'scout' }),
          plan({ id: 'orphan', agentId: 'gone' }),
        ],
        artifacts: [
          report({ id: 'with-launch', agentId: 'scout' }),
          report({ id: 'orphan', agentId: 'gone' }),
        ],
        learnings: [
          learning({ id: 'with-launch', agentId: 'scout' }),
          learning({ id: 'orphan', agentId: 'gone' }),
        ],
      },
    });

    expect(
      ['plan', 'artifact', 'learning'].map((kind) => homes.get(`${kind}:with-launch`)),
    ).toEqual(['activity', 'activity', 'activity']);
    expect(['plan', 'artifact', 'learning'].map((kind) => homes.get(`${kind}:orphan`))).toEqual([
      'log',
      'log',
      'log',
    ]);
  });

  it('keeps an output of a chain with the chain too', () => {
    const homes = homesOf({
      world: {
        agents: [agent({ id: 'lead' }), agent({ id: 'helper', parentAgentId: 'lead' })],
        plans: [plan({ id: 'from-helper', agentId: 'helper' })],
      },
    });

    expect(homes.get('plan:from-helper')).toBe('activity');
  });

  it('sends a question to its launch, to Needs you while open, and to the Log once answered', () => {
    const homes = homesOf({
      world: {
        agents: [agent({ id: 'lead' }), agent({ id: 'helper', parentAgentId: 'lead' })],
        questions: [
          question({ id: 'in-chain', status: 'answered', createdByAgentId: 'helper' }),
          question({ id: 'open', status: 'open' }),
          question({ id: 'done', status: 'answered' }),
        ],
      },
    });

    expect(homes.get('question:in-chain')).toBe('activity');
    expect(homes.get('question:open')).toBeNull();
    expect(homes.get('question:done')).toBe('log');
  });

  it('puts branch, worktree, link, PR, Context and session events in the Log', () => {
    const kinds: ReadonlyArray<SessionEvent['kind']> = [
      'branch_created',
      'project_materialized',
      'rebase_requested',
      'issue_linked',
      'issue_unlinked',
      'pr_created',
      'pr_merged',
      'session_archived',
      'session_restored',
      'decisions_changed',
    ];
    const homes = homesOf({ world: { events: kinds.map((kind) => event({ id: kind, kind })) } });

    for (const kind of kinds) {
      expect(homes.get(`event:${kind}`)).toBe('log');
    }
  });

  it('puts an external task and a branch row in the Log', () => {
    const homes = homesOf({
      world: {
        externalTasks: [
          {
            sessionId: SESSION_ID,
            provider: 'linear',
            externalId: 'har-212',
            identifier: 'HAR-212',
            url: 'https://linear.app/harborline/issue/HAR-212',
            title: 'Duplicate credit on redelivery',
            createdAt: AT,
          },
        ],
        worktrees: [
          {
            id: 'worktree-1',
            sessionId: SESSION_ID,
            worktreePath: '/worktrees/payments-api',
            branch: 'hl/fix-duplicate-credit',
            parallelIndex: 0,
            createdAt: Date.parse(AT),
          },
        ],
      },
    });

    expect([...homes.values()]).toEqual(['log', 'log']);
  });

  it('leaves the start of a workflow to its run and the rest of its events to the Log', () => {
    const homes = homesOf({
      world: {
        events: [
          event({ id: 'w1', kind: 'workflow_started' }),
          event({ id: 'w2', kind: 'workflow_closed' }),
          event({ id: 'w3', kind: 'workflow_deleted' }),
        ],
      },
    });

    expect(homes.get('event:w1')).toBeNull();
    expect(homes.get('event:w2')).toBe('log');
    expect(homes.get('event:w3')).toBe('log');
  });

  it('keeps a row that carries a recovery in Activity until its recovery moves', () => {
    const homes = homesOf({
      world: {
        events: [
          event({
            id: 'rewrite',
            kind: 'history_rewritten',
            payload: { origin: 'plan', backupRef: 'refs/goodboy/backup/1' },
          }),
          event({
            id: 'branch',
            kind: 'branch_deleted',
            payload: { deletedBranchId: 'deleted-1' },
          }),
          event({ id: 'no-backup', kind: 'history_rewritten', payload: { origin: 'plan' } }),
        ],
      },
    });

    expect(homes.get('event:rewrite')).toBe('activity');
    expect(homes.get('event:branch')).toBe('activity');
    expect(homes.get('event:no-backup')).toBe('log');
  });
});

describe('recovery and Needs you for the history of a branch', () => {
  const at = (minutes: number) =>
    new Date(Date.parse(AT) + minutes * 60_000).toISOString() as IsoDateTime;

  it('keeps a rewrite in Activity while nothing later settled it, and drops it to the Log after', () => {
    const rewrite = event({
      id: 'rewrite',
      kind: 'history_rewritten',
      payload: { origin: 'plan', backupRef: 'refs/goodboy/backup/1' },
    });
    const pushed = event({
      id: 'pushed',
      kind: 'history_pushed',
      payload: { origin: 'plan' },
      at: at(5),
    });

    expect(homesOf({ world: { events: [rewrite] } }).get('event:rewrite')).toBe('activity');
    expect(homesOf({ world: { events: [rewrite, pushed] } }).get('event:rewrite')).toBe('log');
    expect(homesOf({ world: { events: [rewrite, pushed] } }).get('event:pushed')).toBe('activity');
  });

  it('sends a stopped rewrite to Needs you while it is open and to the Log once settled', () => {
    const stopped = event({
      id: 'stopped',
      kind: 'history_stopped',
      payload: { origin: 'rebase', reason: 'conflict' },
    });
    const settled = event({
      id: 'settled',
      kind: 'history_rewritten',
      payload: { origin: 'rebase', backupRef: 'refs/goodboy/backup/2' },
      at: at(30),
    });

    expect(homesOf({ world: { events: [stopped] } }).get('event:stopped')).toBeNull();
    expect(homesOf({ world: { events: [stopped, settled] } }).get('event:stopped')).toBe('log');
  });
});

describe('logEntriesMatching', () => {
  const { entries } = buildTimelineGroups({
    sessionId: SESSION_ID,
    agents: [],
    workflows: [],
    plans: [plan({ id: 'webhooks', agentId: 'gone' })],
    artifacts: [],
    externalTasks: [
      {
        sessionId: SESSION_ID,
        provider: 'linear',
        externalId: 'har-212',
        identifier: 'HAR-212',
        url: 'https://linear.app/harborline/issue/HAR-212',
        title: 'Duplicate credit',
        createdAt: AT,
      },
    ],
    questions: [],
    worktrees: [
      {
        id: 'worktree-1',
        sessionId: SESSION_ID,
        worktreePath: '/worktrees/payments-api',
        branch: 'hl/fix-duplicate-credit',
        parallelIndex: 0,
        createdAt: Date.parse(AT),
      },
    ],
    events: [],
    agentKindOverride: {},
  });

  it('keeps everything for an empty search and matches words of any row, ignoring case', () => {
    expect(logEntriesMatching({ entries, query: '  ' })).toHaveLength(3);
    expect(
      logEntriesMatching({ entries, query: 'DUPLICATE' })
        .map((item) => item.kind)
        .sort(),
    ).toEqual(['branch', 'issue']);
    expect(logEntriesMatching({ entries, query: 'webhooks' }).map((item) => item.kind)).toEqual([
      'plan',
    ]);
    expect(logEntriesMatching({ entries, query: 'zzz' })).toEqual([]);
  });
});
