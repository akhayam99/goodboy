// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type IsoDateTime,
  type SessionContextItem,
  type SessionContextItemId,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import { buildTimelineGroups } from './buildTimelineGroups';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });

type LearningParams = {
  readonly id: string;
  readonly status?: SessionContextItem['status'];
  readonly at: string;
};

const learning = ({ id, status = 'active', at }: LearningParams): SessionContextItem => ({
  id: brandId<SessionContextItemId>({ value: id }),
  sessionId: SESSION,
  workspaceId: brandId<WorkspaceId>({ value: 'workspace-1' }),
  kind: 'learning',
  title: `Learned ${id}`,
  text: 'Explained.',
  topic: 'Rust',
  source: null,
  audience: [],
  status,
  projectName: null,
  isSessionDeleted: false,
  createdAt: brandId<IsoDateTime>({ value: at }),
  updatedAt: brandId<IsoDateTime>({ value: at }),
});

type LearningsParams = {
  readonly learnings: ReadonlyArray<SessionContextItem>;
};

const entryIdsOf = ({ learnings }: LearningsParams): ReadonlyArray<string> =>
  buildTimelineGroups({
    sessionId: SESSION,
    agents: [],
    workflows: [],
    plans: [],
    artifacts: [],
    externalTasks: [],
    questions: [],
    worktrees: [],
    events: [],
    learnings,
    agentKindOverride: {},
  }).entries.map((entry) => entry.id);

describe('buildTimelineGroups, learnings', () => {
  it('adds an active learning at its time and leaves a dismissed one out', () => {
    expect(
      entryIdsOf({
        learnings: [
          learning({ id: 'kept', at: '2026-08-17T10:00:00Z' }),
          learning({ id: 'gone', status: 'dismissed', at: '2026-08-17T11:00:00Z' }),
        ],
      }),
    ).toEqual(['learning:kept']);
  });

  it('lists learnings newest first', () => {
    expect(
      entryIdsOf({
        learnings: [
          learning({ id: 'early', at: '2026-08-17T09:00:00Z' }),
          learning({ id: 'late', at: '2026-08-17T10:00:00Z' }),
        ],
      }),
    ).toEqual(['learning:late', 'learning:early']);
  });
});
