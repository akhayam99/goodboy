import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  MountId,
  Project,
  ProjectId,
  SessionId,
  SessionProjectMount,
  WorkspaceId,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useSessionScripts } from './index';

const SESSION_ID = 'session-1' as SessionId;
const WORKSPACE_ID = 'ws-1' as WorkspaceId;
const LEDGER = 'project-ledger' as ProjectId;

const MOUNTS: ReadonlyArray<SessionProjectMount> = [
  {
    mountId: 'mount-1' as MountId,
    sessionId: SESSION_ID,
    projectId: LEDGER,
    mountName: 'ledger-core',
    worktreePath: '/wt/ledger',
    lastWorktreePath: null,
    repoRoot: '/repos/ledger-core',
    branch: 'nw/fix-rounding',
    baseBranch: null,
    parallelIndex: 0,
    isAttached: true,
    diskState: 'present',
    revision: 1,
  },
  {
    mountId: 'mount-2' as MountId,
    sessionId: SESSION_ID,
    projectId: 'project-relay' as ProjectId,
    mountName: 'notify-relay',
    worktreePath: '',
    lastWorktreePath: null,
    repoRoot: '/repos/notify-relay',
    branch: 'main',
    baseBranch: null,
    parallelIndex: 0,
    isAttached: true,
    diskState: 'unchecked',
    revision: 1,
  },
];

const initialState = useAppStore.getState();
const loadDiscoveredScripts = vi.fn(async () => undefined);

beforeEach(() => {
  loadDiscoveredScripts.mockClear();
  useAppStore.setState({
    projects: [{ id: LEDGER, name: 'ledger-core' }] as unknown as ReadonlyArray<Project>,
    projectScripts: {},
    sessionProjectMounts: { [SESSION_ID]: MOUNTS },
    discoveredScripts: {},
    discoveredScriptScans: {},
    loadDiscoveredScripts,
  });
});

afterEach(() => {
  useAppStore.setState(initialState, true);
});

describe('useSessionScripts', () => {
  it('reads package.json of every ready mount only once asked to', () => {
    const { rerender } = renderHook(
      ({ shouldScan }: { readonly shouldScan: boolean }) =>
        useSessionScripts({ sessionId: SESSION_ID, workspaceId: WORKSPACE_ID, shouldScan }),
      { initialProps: { shouldScan: false } },
    );
    expect(loadDiscoveredScripts).not.toHaveBeenCalled();

    rerender({ shouldScan: true });

    expect(loadDiscoveredScripts).toHaveBeenCalledTimes(1);
    expect(loadDiscoveredScripts).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      worktreePath: '/wt/ledger',
    });
  });

  it('groups by mount and says it is still reading until the scan lands', () => {
    const { result, rerender } = renderHook(() =>
      useSessionScripts({ sessionId: SESSION_ID, workspaceId: WORKSPACE_ID, shouldScan: false }),
    );
    expect(result.current.isReading).toBe(true);
    expect(result.current.groups.map((group) => group.projectName)).toEqual([
      'ledger-core',
      'notify-relay',
    ]);

    useAppStore.setState({
      discoveredScripts: {
        [SESSION_ID]: {
          '/wt/ledger': [
            {
              source: 'package-json',
              packageName: 'ledger-core',
              relDir: '',
              manager: 'pnpm',
              scripts: [{ name: 'test', command: 'pnpm run test', body: 'vitest run' }],
            },
          ],
        },
      },
    });
    rerender();

    expect(result.current.isReading).toBe(false);
    expect(result.current.groups[0]?.scripts.map((script) => script.name)).toEqual(['test']);
  });
});
