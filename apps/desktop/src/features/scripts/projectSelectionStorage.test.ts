import { afterEach, describe, expect, it } from 'vitest';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { readScriptsProject, writeScriptsProject } from './projectSelectionStorage';

const workspaceId = 'workspace-1' as WorkspaceId;
const projectId = 'project-1' as ProjectId;

afterEach(() => {
  localStorage.clear();
});

describe('scripts project storage', () => {
  it('returns null before a project is persisted', () => {
    expect(readScriptsProject({ workspaceId })).toBeNull();
  });

  it('round-trips a project per workspace', () => {
    writeScriptsProject({ workspaceId, projectId });

    expect(readScriptsProject({ workspaceId })).toBe(projectId);
    expect(readScriptsProject({ workspaceId: 'workspace-2' as WorkspaceId })).toBeNull();
  });
});
