// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { nextWorkspaceId, TEST_NOW } from '@goodboy/types/testing';
import { folderMetaOf } from './folderMetaOf';

const HARBORLINE = nextWorkspaceId();
const NORTHWIND = nextWorkspaceId();

const PROJECTS = [
  { workspaceId: HARBORLINE, kind: 'repo', disconnectedAt: undefined },
  { workspaceId: HARBORLINE, kind: 'repo', disconnectedAt: undefined },
  { workspaceId: HARBORLINE, kind: 'folder', disconnectedAt: undefined },
  { workspaceId: HARBORLINE, kind: 'repo', disconnectedAt: TEST_NOW },
  { workspaceId: NORTHWIND, kind: 'repo', disconnectedAt: undefined },
] as const;

describe('folderMetaOf', () => {
  it('counts the folders of one workspace and the ones with git', () => {
    expect(folderMetaOf({ projects: PROJECTS, workspaceId: HARBORLINE })).toBe(
      '3 folders · 2 with git',
    );
    expect(folderMetaOf({ projects: PROJECTS, workspaceId: NORTHWIND })).toBe(
      '1 folder · 1 with git',
    );
  });

  it('says so when the workspace has none', () => {
    expect(folderMetaOf({ projects: [], workspaceId: HARBORLINE })).toBe('No folders yet');
  });
});
