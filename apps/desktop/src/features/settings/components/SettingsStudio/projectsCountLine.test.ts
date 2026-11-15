// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { nextWorkspaceId, TEST_NOW } from '@goodboy/types/testing';
import { projectsCountLine } from './projectsCountLine';

const HARBORLINE = nextWorkspaceId();
const NORTHWIND = nextWorkspaceId();

const PROJECTS = [
  { workspaceId: HARBORLINE, kind: 'repo', disconnectedAt: undefined },
  { workspaceId: HARBORLINE, kind: 'repo', disconnectedAt: undefined },
  { workspaceId: HARBORLINE, kind: 'repo', disconnectedAt: undefined },
  { workspaceId: HARBORLINE, kind: 'folder', disconnectedAt: undefined },
  { workspaceId: HARBORLINE, kind: 'repo', disconnectedAt: TEST_NOW },
  { workspaceId: NORTHWIND, kind: 'repo', disconnectedAt: undefined },
  { workspaceId: NORTHWIND, kind: 'folder', disconnectedAt: undefined },
  { workspaceId: NORTHWIND, kind: 'folder', disconnectedAt: undefined },
] as const;

describe('projectsCountLine', () => {
  it('counts repositories as projects and names the plain folders apart', () => {
    expect(projectsCountLine({ projects: PROJECTS, workspaceId: HARBORLINE })).toBe(
      '3 projects, 1 plain folder',
    );
  });

  it('pluralises plain folders and leaves out disconnected projects', () => {
    expect(projectsCountLine({ projects: PROJECTS, workspaceId: NORTHWIND })).toBe(
      '1 project, 2 plain folders',
    );
  });

  it('says nothing about plain folders when there are none', () => {
    expect(projectsCountLine({ projects: PROJECTS.slice(0, 1), workspaceId: HARBORLINE })).toBe(
      '1 project',
    );
  });

  it('says so when the workspace has none', () => {
    expect(projectsCountLine({ projects: [], workspaceId: HARBORLINE })).toBe('No projects yet');
  });
});
