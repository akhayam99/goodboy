// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ProjectId, WorkspaceGitStatus, WorkspaceId } from '@goodboy/types';
import { railSubtitles } from './railSubtitles';

const WORKSPACE_ID = 'ws-1' as WorkspaceId;
const OTHER_WORKSPACE_ID = 'ws-2' as WorkspaceId;

const gitStatus = (state: WorkspaceGitStatus['state']): WorkspaceGitStatus => ({
  state,
  branch: null,
  headSubject: null,
  upstreamDistance: { kind: 'unknown', reason: 'rev-list-failed' },
  workingTree: { kind: 'unknown', reason: 'status-read-failed' },
  upstream: null,
  inProgress: null,
});

const baseState = {
  updaterStatus: 'idle',
  storageFolders: [],
  settings: {},
  storageStats: null,
  openSecurityFindings: {},
  providers: [],
  cliRequirements: [],
  providerLimits: {},
  projects: [],
  projectGitStatus: {},
} as const;

describe('railSubtitles', () => {
  it('flags an available update on General', () => {
    const subtitles = railSubtitles({
      state: { ...baseState, updaterStatus: 'available' },
      workspaceId: null,
    });

    expect(subtitles.generalText).toBe('Update available');
    expect(subtitles.generalTone).toBe('info');
  });

  it('reports no rows needing attention when nothing does', () => {
    const subtitles = railSubtitles({ state: baseState, workspaceId: null });

    expect(subtitles).toEqual({
      generalText: undefined,
      generalTone: undefined,
      storageText: undefined,
      storageTone: undefined,
      securityFindingsText: undefined,
      securityFindingsTone: undefined,
      providersText: undefined,
      providersTone: undefined,
      workspaceText: undefined,
      workspaceTone: undefined,
    });
  });

  it('surfaces open security findings for the current workspace only', () => {
    const subtitles = railSubtitles({
      state: {
        ...baseState,
        openSecurityFindings: { [WORKSPACE_ID]: [{}, {}] } as never,
      },
      workspaceId: WORKSPACE_ID,
    });

    expect(subtitles.securityFindingsText).toBe('2 open');
    expect(subtitles.securityFindingsTone).toBe('warning');
  });

  it('counts missing project folders for the current workspace', () => {
    const p1 = 'p1' as ProjectId;
    const p2 = 'p2' as ProjectId;
    const p3 = 'p3' as ProjectId;
    const subtitles = railSubtitles({
      state: {
        ...baseState,
        projects: [
          { id: p1, workspaceId: WORKSPACE_ID },
          { id: p2, workspaceId: WORKSPACE_ID },
          { id: p3, workspaceId: OTHER_WORKSPACE_ID },
        ] as never,
        projectGitStatus: {
          [p1]: gitStatus('missing'),
          [p2]: gitStatus('ready'),
          [p3]: gitStatus('missing'),
        },
      },
      workspaceId: WORKSPACE_ID,
    });

    expect(subtitles.workspaceText).toBe('1 folder not found');
    expect(subtitles.workspaceTone).toBe('warning');
  });

  it('never counts missing folders without a current workspace', () => {
    const p1 = 'p1' as ProjectId;
    const subtitles = railSubtitles({
      state: {
        ...baseState,
        projects: [{ id: p1, workspaceId: WORKSPACE_ID }] as never,
        projectGitStatus: { [p1]: gitStatus('missing') },
      },
      workspaceId: null,
    });

    expect(subtitles.workspaceText).toBeUndefined();
  });
});
