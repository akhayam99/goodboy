import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Session,
  SessionId,
  ProjectId,
  WorkspaceId,
  ProjectScript,
  ProjectScriptId,
} from '@goodboy/types';
import type { ScriptRunRecord } from '../../scripts';

type StoreState = {
  readonly scriptRuns: Readonly<Record<string, Readonly<Record<string, ScriptRunRecord>>>>;
  readonly sessions: ReadonlyArray<Session>;
  readonly archivedSessions: Readonly<Record<string, ReadonlyArray<Session>>>;
  readonly projectScripts: Readonly<Record<string, ReadonlyArray<ProjectScript>>>;
};

const { store } = vi.hoisted(() => ({
  store: {
    state: {
      scriptRuns: {},
      sessions: [],
      archivedSessions: {},
      projectScripts: {},
    } as StoreState,
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T>(selector: (state: StoreState) => T) => selector(store.state),
}));

import { useRunningScripts } from './useRunningScripts';

const SESSION_A = 'session-a' as SessionId;
const SESSION_B = 'session-b' as SessionId;
const WORKSPACE_A = 'workspace-a' as WorkspaceId;
const WORKSPACE_B = 'workspace-b' as WorkspaceId;
const PROJECT_A = 'project-a' as ProjectId;
const PROJECT_B = 'project-b' as ProjectId;
const SHARED_SCRIPT = 'shared-script' as ProjectScriptId;

beforeEach(() => {
  store.state = {
    scriptRuns: {},
    sessions: [],
    archivedSessions: {},
    projectScripts: {},
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useRunningScripts', () => {
  it('counts a pending run from an archived session', () => {
    store.state = {
      sessions: [],
      archivedSessions: {
        [WORKSPACE_A]: [
          { id: SESSION_A, workspaceId: WORKSPACE_A, goal: 'archived goal' } as Session,
        ],
      },
      projectScripts: {
        [WORKSPACE_A]: [
          { id: SHARED_SCRIPT, projectId: PROJECT_A, name: 'archived setup' } as ProjectScript,
        ],
      },
      scriptRuns: {
        [SESSION_A]: {
          [SHARED_SCRIPT]: {
            status: 'pending',
            result: null,
            runId: 'run-archived',
            startedAt: 10,
          },
        },
      },
    };

    const { result } = renderHook(() => useRunningScripts());

    expect(result.current).toEqual([
      expect.objectContaining({ sessionId: SESSION_A, scriptName: 'archived setup' }),
    ]);
  });

  it('resolves each running script name from its session workspace', () => {
    store.state = {
      sessions: [
        {
          id: SESSION_A,
          workspaceId: WORKSPACE_A,
          goal: 'alpha goal',
        } as Session,
        {
          id: SESSION_B,
          workspaceId: WORKSPACE_B,
          goal: 'beta goal',
        } as Session,
      ],
      archivedSessions: {},
      projectScripts: {
        [WORKSPACE_A]: [
          {
            id: SHARED_SCRIPT,
            projectId: PROJECT_A,
            name: 'alpha setup',
          } as ProjectScript,
        ],
        [WORKSPACE_B]: [
          {
            id: SHARED_SCRIPT,
            projectId: PROJECT_B,
            name: 'beta setup',
          } as ProjectScript,
        ],
      },
      scriptRuns: {
        [SESSION_A]: {
          [SHARED_SCRIPT]: {
            status: 'pending',
            result: null,
            runId: 'run-a',
            startedAt: 20,
          },
        },
        [SESSION_B]: {
          [SHARED_SCRIPT]: {
            status: 'pending',
            result: null,
            runId: 'run-b',
            startedAt: 10,
          },
        },
      },
    };

    const { result } = renderHook(() => useRunningScripts());

    expect(result.current.map(({ sessionId, scriptName }) => ({ sessionId, scriptName }))).toEqual([
      { sessionId: SESSION_B, scriptName: 'beta setup' },
      { sessionId: SESSION_A, scriptName: 'alpha setup' },
    ]);
  });

  it('uses the generic name when the script was deleted from the session workspace', () => {
    store.state = {
      sessions: [
        {
          id: SESSION_A,
          workspaceId: WORKSPACE_A,
          goal: 'alpha goal',
        } as Session,
      ],
      archivedSessions: {},
      projectScripts: {
        [WORKSPACE_A]: [],
        [WORKSPACE_B]: [
          {
            id: SHARED_SCRIPT,
            projectId: PROJECT_B,
            name: 'other workspace setup',
          } as ProjectScript,
        ],
      },
      scriptRuns: {
        [SESSION_A]: {
          [SHARED_SCRIPT]: {
            status: 'pending',
            result: null,
            runId: 'run-deleted',
            startedAt: 10,
          },
        },
      },
    };

    const { result } = renderHook(() => useRunningScripts());

    expect(result.current[0]?.scriptName).toBe('script');
  });

  it('sorts pending runs by startedAt and excludes finished runs', () => {
    const EARLY_SCRIPT = 'early-script' as ProjectScriptId;
    const LATE_SCRIPT = 'late-script' as ProjectScriptId;
    const FINISHED_SCRIPT = 'finished-script' as ProjectScriptId;
    store.state = {
      sessions: [
        {
          id: SESSION_A,
          workspaceId: WORKSPACE_A,
          goal: 'alpha goal',
        } as Session,
      ],
      archivedSessions: {},
      projectScripts: {
        [WORKSPACE_A]: [
          {
            id: EARLY_SCRIPT,
            projectId: PROJECT_A,
            name: 'early',
          } as ProjectScript,
          {
            id: LATE_SCRIPT,
            projectId: PROJECT_A,
            name: 'late',
          } as ProjectScript,
          {
            id: FINISHED_SCRIPT,
            projectId: PROJECT_A,
            name: 'finished',
          } as ProjectScript,
        ],
      },
      scriptRuns: {
        [SESSION_A]: {
          [LATE_SCRIPT]: {
            status: 'pending',
            result: null,
            runId: 'run-late',
            startedAt: 30,
          },
          [FINISHED_SCRIPT]: {
            status: 'ok',
            result: { stdout: '', stderr: '', exitCode: 0 },
            runId: 'run-finished',
            startedAt: 5,
          },
          [EARLY_SCRIPT]: {
            status: 'pending',
            result: null,
            runId: 'run-early',
            startedAt: 10,
          },
        },
      },
    };

    const { result } = renderHook(() => useRunningScripts());

    expect(result.current.map((run) => run.scriptId)).toEqual([EARLY_SCRIPT, LATE_SCRIPT]);
  });
});
