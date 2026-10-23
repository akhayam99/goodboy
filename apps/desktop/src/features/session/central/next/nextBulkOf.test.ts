import { describe, expect, it } from 'vitest';
import {
  brandId,
  type AgentId,
  type MountId,
  type ProjectId,
  type SessionId,
} from '@goodboy/types';
import type { RebaseStopRow } from '../../../history/rebaseStopRowOf';
import type { RebaseSuggestionTarget, SessionSuggestion } from '../../../suggestions/types';
import type { NeedsYouOwner } from '../../timeline/needsYou';
import { actionCardsOf, type AutoActionTarget } from './actionCardsOf';
import { nextBulkOf } from './nextBulkOf';
import { nextGroupsOf, type NextGroupModel } from './nextGroupsOf';

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });

type NameParams = {
  readonly name: string;
};

const mountOf = ({ name }: NameParams): MountId => brandId<MountId>({ value: `mount-${name}` });

const MEMBERS = mountOf({ name: 'members' });
const PROFILE = mountOf({ name: 'profile' });
const BILLING = mountOf({ name: 'billing' });
const HOME = mountOf({ name: 'home' });

type StopOwnerParams = {
  readonly mountId: MountId;
};

const stopOwnerOf = ({ mountId }: StopOwnerParams): NeedsYouOwner => ({
  id: `event:stop-${mountId}`,
  kind: 'rebase',
  text: `Rebase of ${mountId} stopped`,
  where: null,
  at: '2026-10-22T10:00:00.000Z',
  item: null,
  question: null,
  questionIds: [],
  prNumber: null,
  owed: null,
  mountId,
});

type RowParams = {
  readonly mountId: MountId;
  readonly verb: RebaseStopRow['verb'];
};

const rowOf = ({ mountId, verb }: RowParams): RebaseStopRow => ({
  mountId,
  state: verb === 'bring-in' ? 'origin-moved' : verb === 'resolve-auto' ? 'conflict' : 'failed',
  sentence: 'It stopped.',
  verb,
  isAsking: verb === 'resolve-auto',
  canKeep: verb !== 'bring-in',
  hasBackup: false,
});

type TargetParams = {
  readonly mountId: MountId;
  readonly name: string;
};

const targetOf = ({ mountId, name }: TargetParams): RebaseSuggestionTarget => ({
  id: `target-${name}`,
  mountId,
  projectId: brandId<ProjectId>({ value: 'project-harbor-portal' }),
  projectName: 'harbor-portal',
  branch: `hl/feat-center-${name}-page`,
  worktreePath: `/w/${name}`,
  baseBranch: 'main',
  behind: 3,
  dirtyCount: 0,
});

type BehindParams = {
  readonly targets: ReadonlyArray<RebaseSuggestionTarget>;
};

const behindOf = ({ targets }: BehindParams): SessionSuggestion => ({
  id: `rebase-project:${SESSION_ID}`,
  kind: 'rebase-project',
  priority: 20,
  band: 2,
  title: `Rebase ${targets.length} branches`,
  sessionId: SESSION_ID,
  targetKey: null,
  fingerprint: `rebase-project:${targets.length}`,
  payload: { targets },
});

const BEHIND = behindOf({ targets: [targetOf({ mountId: HOME, name: 'home' })] });

type GroupParams = {
  readonly owners: ReadonlyArray<NeedsYouOwner>;
  readonly suggestions?: ReadonlyArray<SessionSuggestion>;
  readonly autoTargets?: ReadonlyArray<AutoActionTarget>;
  readonly id: NextGroupModel['id'];
};

const groupOf = ({ owners, suggestions = [], autoTargets = [], id }: GroupParams) => {
  const group = nextGroupsOf({
    cards: actionCardsOf({ owners, suggestions, autoTargets }),
    seen: [],
  }).find((candidate) => candidate.id === id);
  if (group === undefined) {
    throw new Error(`no ${id} group`);
  }
  return group;
};

const ROWS: ReadonlyMap<string, RebaseStopRow> = new Map([
  [MEMBERS, rowOf({ mountId: MEMBERS, verb: 'resolve-auto' })],
  [PROFILE, rowOf({ mountId: PROFILE, verb: 'bring-in' })],
  [BILLING, rowOf({ mountId: BILLING, verb: 'retry-rebase' })],
]);

type StopParams = {
  readonly mountId: string | null;
};

const stopRowFor = ({ mountId }: StopParams) =>
  mountId === null ? null : (ROWS.get(mountId) ?? null);

describe('nextBulkOf', () => {
  it('updates every stopped and behind branch from one Update all, bringing origin in where it moved', () => {
    const group = groupOf({
      id: 'update',
      owners: [MEMBERS, PROFILE, BILLING].map((mountId) => stopOwnerOf({ mountId })),
      suggestions: [BEHIND],
    });

    expect(nextBulkOf({ group, sessionId: SESSION_ID, stopRowFor })).toEqual({
      kind: 'update',
      label: 'Update all 4',
      sessionId: SESSION_ID,
      rebaseMountIds: [HOME, BILLING, MEMBERS],
      bringInMountIds: [PROFILE],
    });
  });

  it('offers nothing for a single branch', () => {
    const group = groupOf({ id: 'update', owners: [stopOwnerOf({ mountId: PROFILE })] });

    expect(nextBulkOf({ group, sessionId: SESSION_ID, stopRowFor })).toBeNull();
  });

  it('skips a stop whose row is gone, so a settled branch is not updated again', () => {
    const group = groupOf({
      id: 'update',
      owners: [
        stopOwnerOf({ mountId: MEMBERS }),
        stopOwnerOf({ mountId: mountOf({ name: 'gone' }) }),
      ],
    });

    expect(nextBulkOf({ group, sessionId: SESSION_ID, stopRowFor })).toBeNull();
  });

  it('keeps Rebase all when the stack cannot read the stops', () => {
    const twoBehind = behindOf({
      targets: [
        targetOf({ mountId: HOME, name: 'home' }),
        targetOf({ mountId: BILLING, name: 'billing' }),
      ],
    });
    const group = groupOf({ id: 'update', owners: [], suggestions: [twoBehind] });

    expect(nextBulkOf({ group })?.kind).toBe('rebase');
  });

  it('still retries the stuck agents in Fix', () => {
    const stuck = ({ name }: NameParams): AutoActionTarget => ({
      agentId: brandId<AgentId>({ value: name }),
      rootAgentId: brandId<AgentId>({ value: 'agent-auto' }),
      role: 'Tester',
      noun: 'Tester',
      kind: 'timedOut',
      reason: null,
      reasonCode: null,
      mountId: null,
      plan: null,
      canRetry: true,
    });
    const group = groupOf({
      id: 'fix',
      owners: [],
      autoTargets: [stuck({ name: 'agent-a' }), stuck({ name: 'agent-b' })],
    });

    expect(nextBulkOf({ group, sessionId: SESSION_ID, stopRowFor })?.label).toBe('Retry 2');
  });
});
