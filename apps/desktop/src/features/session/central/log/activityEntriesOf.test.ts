// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type MountId,
  type ProjectId,
  type SessionContextItemId,
  type SessionId,
  type SessionProjectMount,
  type WorkflowId,
  type WorkspaceId,
} from '@goodboy/types';
import { anAgent, aWorkflowRun } from '@goodboy/types/testing';
import type {
  TimelineAgentEntry,
  TimelineLearningEntry,
  TimelineRunEntry,
  TimelineTopLevelEntry,
} from '../../timeline/buildTimelineGroups';
import { buildTimelineStream } from '../../timeline/buildTimelineStream';
import type { ActivityFilter } from './activityEntryMatches';
import { activityEntriesOf } from './activityEntriesOf';

const SESSION_ID = brandId<SessionId>({ value: 'session-ledger-core' });
const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const LEDGER = brandId<MountId>({ value: 'mount-ledger-core' });
const RELAY = brandId<MountId>({ value: 'mount-notify-relay' });
const AT = brandId<IsoDateTime>({ value: '2026-11-20T10:00:00.000Z' });
const IDENTITY = { stroke: 'stroke-a', spin: 'spin-a', index: 0 };

type MountParams = {
  readonly mountId: MountId;
  readonly name: string;
};

const mountOf = ({ mountId, name }: MountParams) =>
  ({
    mountId,
    sessionId: SESSION_ID,
    projectId: brandId<ProjectId>({ value: `project-${name}` }),
    mountName: name,
    worktreePath: `~/code/harborline/${name}`,
    lastWorktreePath: null,
    repoRoot: `~/code/harborline/${name}`,
    branch: 'hl/export',
    baseBranch: 'main',
    parallelIndex: 0,
    isAttached: true,
    diskState: 'present',
    revision: 0,
  }) satisfies SessionProjectMount;

const MOUNTS = [
  mountOf({ mountId: LEDGER, name: 'ledger-core' }),
  mountOf({ mountId: RELAY, name: 'notify-relay' }),
];

type AgentParams = {
  readonly id: string;
  readonly mountId: MountId;
  readonly children?: ReadonlyArray<TimelineAgentEntry>;
};

const agentEntryOf = ({ id, mountId, children = [] }: AgentParams): TimelineAgentEntry => ({
  kind: 'agent',
  id: `agent:${id}`,
  at: AT,
  ordinal: 0,
  agent: anAgent({ id: brandId<AgentId>({ value: id }), sessionId: SESSION_ID, mountId }),
  agentKind: 'implementer',
  isMissingArtifact: false,
  stepLabel: null,
  openQuestions: [],
  terminalQuestions: [],
  children,
  answers: [],
  hasDuration: true,
  chain: null,
});

const workflowId = brandId<WorkflowId>({ value: 'workflow-export' });

const runEntry: TimelineRunEntry = {
  kind: 'run',
  id: 'run:export',
  at: AT,
  run: aWorkflowRun({ workflowId, createdAt: AT }),
  workflow: {
    id: workflowId,
    workspaceId: WORKSPACE_ID,
    name: 'Export workflow',
    description: '',
    steps: [],
    createdAt: AT,
    updatedAt: AT,
  },
  identity: IDENTITY,
  children: [
    agentEntryOf({ id: 'step-ledger', mountId: LEDGER }),
    agentEntryOf({ id: 'step-relay', mountId: RELAY }),
  ],
  producedPlan: null,
};

const leadEntry = agentEntryOf({
  id: 'lead',
  mountId: LEDGER,
  children: [agentEntryOf({ id: 'helper-relay', mountId: RELAY })],
});

type LearningParams = {
  readonly id: string;
} & Pick<TimelineLearningEntry, 'lane' | 'launchEntryId'>;

const learningOf = ({ id, ...attachment }: LearningParams): TimelineLearningEntry => ({
  kind: 'learning',
  id: `learning:${id}`,
  at: AT,
  item: {
    id: brandId<SessionContextItemId>({ value: id }),
    sessionId: SESSION_ID,
    workspaceId: WORKSPACE_ID,
    kind: 'learning',
    title: `Learned ${id}`,
    text: 'Refunds keep the ledger key',
    topic: null,
    source: null,
    audience: [],
    status: 'active',
    projectName: null,
    isSessionDeleted: false,
    createdAt: AT,
    updatedAt: AT,
  },
  ...attachment,
});

const laneLearning = learningOf({
  id: 'lane',
  lane: { identity: IDENTITY, rootEntryId: runEntry.id },
});

const launchLearning = learningOf({ id: 'launch', launchEntryId: leadEntry.id });

const ENTRIES: ReadonlyArray<TimelineTopLevelEntry> = [
  runEntry,
  leadEntry,
  laneLearning,
  launchLearning,
];

type FilterParams = {
  readonly filter: ActivityFilter;
};

const narrowed = ({ filter }: FilterParams) =>
  activityEntriesOf({ entries: ENTRIES, filter, mounts: MOUNTS });

type EntriesParams = {
  readonly entries: ReadonlyArray<TimelineTopLevelEntry>;
};

const rowIdsOf = ({ entries }: EntriesParams): ReadonlyArray<string> =>
  buildTimelineStream({
    entries,
    unreadAgentIds: new Set(),
    advanceByRunId: new Map(),
    decidingRunIds: new Set(),
    dayLabelFor: ({ at }) => at,
    shouldExpandEveryGroup: true,
    foldsFinished: true,
  }).items.flatMap((item) => (item.kind === 'row' ? [item.id] : []));

type ChildIdsParams = {
  readonly entry: TimelineTopLevelEntry | undefined;
};

const childIdsOf = ({ entry }: ChildIdsParams): ReadonlyArray<string> =>
  entry?.kind === 'run' || entry?.kind === 'agent' ? entry.children.map((child) => child.id) : [];

describe('activityEntriesOf', () => {
  it('gives every entry back untouched when no filter is set', () => {
    expect(narrowed({ filter: { kind: null, mountIds: new Set() } })).toBe(ENTRIES);
  });

  it('keeps only the rows of the chosen project inside a workflow and under an agent', () => {
    const relay = narrowed({ filter: { kind: null, mountIds: new Set([RELAY]) } });
    const [run, lead] = relay;

    expect(childIdsOf({ entry: run })).toEqual(['agent:step-relay']);
    expect(childIdsOf({ entry: lead })).toEqual(['agent:helper-relay']);
    expect(rowIdsOf({ entries: relay })).not.toContain('agent:step-ledger');
  });

  it('keeps a workflow whose agents all ran in the chosen project as it is', () => {
    const both = narrowed({ filter: { kind: null, mountIds: new Set([LEDGER, RELAY]) } });

    expect(both[0]).toBe(runEntry);
    expect(both[1]).toBe(leadEntry);
  });

  it('shows context written inside a workflow lane or by an agent under Context', () => {
    const context = narrowed({ filter: { kind: 'context', mountIds: new Set() } });

    expect(context.map((entry) => entry.id)).toEqual([laneLearning.id, launchLearning.id]);
    expect(rowIdsOf({ entries: context })).toEqual(
      expect.arrayContaining([laneLearning.id, launchLearning.id]),
    );
    expect(rowIdsOf({ entries: [laneLearning, launchLearning] })).toEqual([]);
  });
});
