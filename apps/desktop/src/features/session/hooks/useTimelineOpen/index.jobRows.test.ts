// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  ProjectId,
  SessionEvent,
  SessionEventId,
  SessionEventKind,
  SessionEventPayload,
  SessionProjectMount,
} from '@goodboy/types';
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

type EventEntryParams = {
  readonly kind: SessionEventKind;
  readonly payload: SessionEventPayload;
};

const eventEntry = ({ kind, payload }: EventEntryParams): TimelineStreamEntry => {
  const event: SessionEvent = {
    id: brandedId<SessionEventId>({ value: 'ev-stop' }),
    sessionId: A_REBASE_SESSION_ID,
    kind,
    payload,
    createdAt: brandedId<IsoDateTime>({ value: '2026-10-10T09:00:00.000Z' }),
  };
  const entry = buildTimelineGroups({
    sessionId: A_REBASE_SESSION_ID,
    agents: [],
    workflows: [],
    plans: [],
    artifacts: [],
    externalTasks: [],
    questions: [],
    worktrees: [],
    events: [event],
    agentKindOverride: {},
  }).entries.find((candidate) => candidate.kind === 'event');
  if (entry === undefined) {
    throw new Error('the groups hold no event');
  }
  return entry;
};

const OTHER_MOUNT: SessionProjectMount = {
  ...MOUNT,
  mountId: brandedId<SessionProjectMount['mountId']>({ value: 'mount-relay' }),
  mountName: 'notify-relay',
  worktreePath: '/w/notify-relay',
  branch: 'hl/feat-center-profile-page',
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

  describe('a saved history event', () => {
    const navigatedPath = (navigate: ReturnType<typeof vi.fn>): unknown =>
      navigate.mock.calls[0]?.[0]?.to?.view?.target?.mountPath;

    it('opens a stopped rebase on its own branch by mount id, even when the path moved', () => {
      const navigate = vi.fn();
      useAppStore.setState({
        navigate,
        sessionProjectMounts: { [A_REBASE_SESSION_ID]: [OTHER_MOUNT, MOUNT] },
        diffMountPath: { [A_REBASE_SESSION_ID]: '/w/notify-relay' },
      });
      const { result } = renderHook(() => useTimelineOpen({ sessionId: A_REBASE_SESSION_ID }));

      const target = result.current({
        entry: eventEntry({
          kind: 'history_stopped',
          payload: {
            mountId: A_REBASE_MOUNT_ID,
            worktreePath: '/w/old-copy-of-payments-api',
            branch: MOUNT.branch,
            origin: 'rebase',
            reason: 'conflict',
          },
        }),
      });
      target?.open();

      expect(target?.label).toBe('Open rebase');
      expect(navigatedPath(navigate)).toBe('/w/payments-api');
      expect(navigate.mock.calls[0]?.[0]?.to?.view?.target?.tab).toBe('commits');
    });

    it('offers no verb, and never the first branch, once the stopped branch left the session', () => {
      const navigate = vi.fn();
      useAppStore.setState({
        navigate,
        sessionProjectMounts: { [A_REBASE_SESSION_ID]: [OTHER_MOUNT] },
        diffMountPath: { [A_REBASE_SESSION_ID]: '/w/notify-relay' },
      });
      const { result } = renderHook(() => useTimelineOpen({ sessionId: A_REBASE_SESSION_ID }));

      const target = result.current({
        entry: eventEntry({
          kind: 'history_stopped',
          payload: {
            mountId: A_REBASE_MOUNT_ID,
            worktreePath: '/w/payments-api',
            origin: 'rebase',
            reason: 'conflict',
          },
        }),
      });

      expect(target).toBeNull();
      expect(navigate).not.toHaveBeenCalled();
    });

    it('keeps Open commits for a rewrite event of the same branch', () => {
      const navigate = vi.fn();
      useAppStore.setState({ navigate });
      const { result } = renderHook(() => useTimelineOpen({ sessionId: A_REBASE_SESSION_ID }));

      const target = result.current({
        entry: eventEntry({
          kind: 'history_rewritten',
          payload: { mountId: A_REBASE_MOUNT_ID, origin: 'plan', backupRef: 'refs/backup/1' },
        }),
      });
      target?.open();

      expect(target?.label).toBe('Open commits');
      expect(navigatedPath(navigate)).toBe('/w/payments-api');
    });
  });
});
