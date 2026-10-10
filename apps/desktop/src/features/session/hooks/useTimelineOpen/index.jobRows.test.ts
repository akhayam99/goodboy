// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Agent, AgentId, IsoDateTime, ProjectId, SessionProjectMount } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  A_REBASE_AGENT_ID,
  A_REBASE_MOUNT_ID,
  A_REBASE_SESSION_ID,
  aRebaseRun,
} from '../../../history/testing/aRebaseRun';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import { useAppStore } from '../../../../store';
import type { AgentKind } from '../../agent-kind';
import { buildTimelineGroups } from '../../timeline/buildTimelineGroups';
import type { TimelineStreamEntry } from '../../timeline/buildTimelineStream';
import { useTimelineOpen } from './index';
import { brandedId } from '../../../history/testing/brandedId';

const MOUNT: SessionProjectMount = {
  mountId: A_REBASE_MOUNT_ID,
  sessionId: A_REBASE_SESSION_ID,
  projectId: brandedId<ProjectId>({ value: 'project-payments' }),
  mountName: 'payments-api',
  worktreePath: '/w/payments-api',
  lastWorktreePath: null,
  repoRoot: '/repos/payments-api',
  branch: 'hl/fix-duplicate-credit',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

const agentEntry = ({
  id,
  kind,
}: {
  readonly id: string;
  readonly kind: AgentKind;
}): TimelineStreamEntry => {
  const agent: Agent = {
    id: brandedId<AgentId>({ value: id }),
    sessionId: A_REBASE_SESSION_ID,
    ordinal: 1,
    name: kind === 'scribe' ? 'Scribe' : 'History rewriter',
    status: 'completed',
    startedAt: brandedId<IsoDateTime>({ value: '2026-10-10T09:00:00.000Z' }),
  };
  const [entry] = buildTimelineGroups({
    sessionId: A_REBASE_SESSION_ID,
    agents: [agent],
    workflows: [],
    plans: [],
    artifacts: [],
    externalTasks: [],
    questions: [],
    worktrees: [],
    events: [],
    agentKindOverride: { [id]: kind },
  }).entries;
  if (entry === undefined || entry.kind !== 'agent') {
    throw new Error('the groups hold no agent');
  }
  return entry;
};

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    sessions: [aSession({ id: A_REBASE_SESSION_ID })],
    sessionProjectMounts: { [A_REBASE_SESSION_ID]: [MOUNT] },
    historyRuns: {
      [A_REBASE_MOUNT_ID]: aRebaseRun({ phase: 'stopped', agentId: A_REBASE_AGENT_ID }),
    },
  });
});

describe('the verb of a job row', () => {
  it('opens the rebase on the Commits section of the mount for the rewriter', () => {
    const openRewriteHistory = vi.fn();
    useAppStore.setState({ openRewriteHistory });
    const { result } = renderHook(() => useTimelineOpen({ sessionId: A_REBASE_SESSION_ID }));

    const target = result.current({
      entry: agentEntry({ id: A_REBASE_AGENT_ID, kind: 'rewriter' }),
    });
    target?.open();

    expect(target?.label).toBe('Open rebase');
    expect(openRewriteHistory).toHaveBeenCalledWith(A_REBASE_SESSION_ID, '/w/payments-api');
  });

  it('opens the Overview section of the mount for Scribe', () => {
    useAppStore.setState({
      scribeAgents: { [brandedId<AgentId>({ value: 'agent-scribe' })]: 'pr:mount-payments' },
      scribeWork: {
        'pr:mount-payments': {
          key: 'pr:mount-payments',
          sessionId: A_REBASE_SESSION_ID,
          mountId: A_REBASE_MOUNT_ID,
          agentId: brandedId<AgentId>({ value: 'agent-scribe' }),
          task: { kind: 'pr', closedPrNumber: null, references: [], isDraft: false, base: null },
          status: 'writing',
          output: null,
          error: null,
          pullRequest: null,
          updatedAt: 0,
        },
      },
    });
    const navigate = vi.fn();
    useAppStore.setState({ navigate });
    const { result } = renderHook(() => useTimelineOpen({ sessionId: A_REBASE_SESSION_ID }));

    const target = result.current({ entry: agentEntry({ id: 'agent-scribe', kind: 'scribe' }) });
    target?.open();

    expect(target?.label).toBe('Open overview');
    expect(navigate).toHaveBeenCalledWith({
      to: expect.objectContaining({
        view: expect.objectContaining({
          lens: 'branch',
          target: expect.objectContaining({
            kind: 'branch',
            tab: 'pr',
            mountPath: '/w/payments-api',
          }),
        }),
      }),
    });
  });

  it('keeps Open chat for any other agent', () => {
    const { result } = renderHook(() => useTimelineOpen({ sessionId: A_REBASE_SESSION_ID }));

    expect(
      result.current({ entry: agentEntry({ id: 'agent-other', kind: 'implementer' }) })?.label,
    ).toBe('Open chat');
  });
});
