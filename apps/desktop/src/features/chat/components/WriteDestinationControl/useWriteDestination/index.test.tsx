// @vitest-environment happy-dom

import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { create } from 'zustand';
import type { AgentId, MountId, ProjectId, SessionId } from '@goodboy/types';
import type { WriteDestination } from '../../../../../store/slices/project-mounts/writeDestination';

vi.mock('../../../../../features/worktree/worktree', () => ({
  scratchDirPrepare: vi.fn(async () => '/goodboy/scratch/unused'),
}));

type StoreShape = {
  sessions: ReadonlyArray<Record<string, unknown>>;
  sessionActiveMount: Record<string, string | null>;
  sessionActiveProject: Record<string, string>;
  sessionMounts: Record<string, ReadonlyArray<unknown>>;
  sessionProjectMounts: Record<string, ReadonlyArray<Record<string, unknown>>>;
  projects: ReadonlyArray<Record<string, unknown>>;
  agentTurnState: Record<string, { kind: string }>;
  agentTurnDestination: Record<string, WriteDestination>;
};

const SESSION_ID = 'session-1' as SessionId;
const OTHER_SESSION_ID = 'session-2' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const PROJECT_ID = 'project-web' as ProjectId;
const MOUNT_A = 'mount-a' as MountId;
const MOUNT_B = 'mount-b' as MountId;

const mount = ({ mountId, branch }: { readonly mountId: MountId; readonly branch: string }) => ({
  mountId,
  projectId: PROJECT_ID,
  mountName: mountId,
  branch,
  worktreePath: `/sessions/one/${mountId}`,
  repoRoot: '/repos/web',
  isAttached: true,
});

const buildStore = () =>
  create<StoreShape>(() => ({
    sessions: [
      { id: SESSION_ID, activeMountId: null, activeProjectId: null },
      { id: OTHER_SESSION_ID, activeMountId: null, activeProjectId: null },
    ],
    sessionActiveMount: { [SESSION_ID]: MOUNT_A },
    sessionActiveProject: {},
    sessionMounts: {},
    sessionProjectMounts: {
      [SESSION_ID]: [
        mount({ mountId: MOUNT_A, branch: 'ak/feat-a' }),
        mount({ mountId: MOUNT_B, branch: 'ak/feat-b' }),
      ],
      [OTHER_SESSION_ID]: [],
    },
    projects: [{ id: PROJECT_ID, name: 'web', kind: 'repo' }],
    agentTurnState: {},
    agentTurnDestination: {},
  }));

let testStore: ReturnType<typeof buildStore>;

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(selector: (state: StoreShape) => T) => testStore(selector),
}));

import { useWriteDestination } from './index';

afterEach(cleanup);

describe('useWriteDestination, subscription scope', () => {
  it('ignores an unrelated session update and reacts only to its own session', () => {
    testStore = buildStore();
    let renderCount = 0;
    let lastLabel: string | null = null;

    const Probe = () => {
      renderCount += 1;
      const { next } = useWriteDestination({ sessionId: SESSION_ID, agentId: AGENT_ID });
      lastLabel = next.kind === 'mount' ? next.mountName : next.kind;
      return null;
    };

    render(<Probe />);
    expect(renderCount).toBe(1);
    expect(lastLabel).toBe(MOUNT_A);

    act(() => {
      testStore.setState((state) => ({
        sessions: state.sessions.map((candidate) =>
          candidate.id === OTHER_SESSION_ID
            ? { ...candidate, activeProjectId: 'noise' }
            : candidate,
        ),
        sessionActiveMount: { ...state.sessionActiveMount, [OTHER_SESSION_ID]: 'mount-noise' },
      }));
    });
    expect(renderCount).toBe(1);

    act(() => {
      testStore.setState((state) => ({
        sessionActiveMount: { ...state.sessionActiveMount, [SESSION_ID]: MOUNT_B },
      }));
    });
    expect(renderCount).toBe(2);
    expect(lastLabel).toBe(MOUNT_B);
  });

  it('resolves the automatic fallback without selecting the session mount', () => {
    testStore = buildStore();
    testStore.setState({
      sessionActiveMount: {},
      sessionProjectMounts: {
        [SESSION_ID]: [
          { ...mount({ mountId: MOUNT_A, branch: 'ak/feat-a' }), parallelIndex: 2 },
          { ...mount({ mountId: MOUNT_B, branch: 'ak/feat-b' }), parallelIndex: 1 },
        ],
        [OTHER_SESSION_ID]: [],
      },
    });
    let selectedMountId: MountId | null = null;
    let isAutomatic = false;

    const Probe = () => {
      const view = useWriteDestination({
        sessionId: SESSION_ID,
        agentId: AGENT_ID,
        fallback: 'automatic',
      });
      selectedMountId = view.next.kind === 'mount' ? view.next.mountId : null;
      isAutomatic = view.isAutomatic;
      return null;
    };

    render(<Probe />);

    expect(selectedMountId).toBe(MOUNT_B);
    expect(isAutomatic).toBe(true);
    expect(testStore.getState().sessionActiveMount[SESSION_ID]).toBeUndefined();
  });
});
