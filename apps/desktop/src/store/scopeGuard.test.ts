import { describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  Project,
  ProjectId,
  SessionProjectMount,
  WorkspaceId,
} from '@goodboy/types';
import { buildScopeGuard } from './scopeGuard';

const NOW = '2026-08-22T00:00:00.000Z' as IsoDateTime;
const WORKSPACE_ID = 'workspace-guard' as WorkspaceId;

const buildProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'project-app' as ProjectId,
  workspaceId: WORKSPACE_ID,
  name: 'app',
  rootPath: '/tmp/app',
  kind: 'repo',
  overrides: {
    defaultProviderId: null,
    defaultWorkflowId: null,
    defaultBranchPrefix: null,
    parallelEnabled: null,
    defaultVerbosity: null,
    providerBindings: null,
    taskModels: null,
    roleModels: null,
    parallelAgents: null,
    providerPool: null,
  },
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

const app = buildProject();
const web = buildProject({ id: 'project-web' as ProjectId, name: 'web', rootPath: '/tmp/web' });

const appMount: SessionProjectMount = {
  projectId: app.id,
  mountName: 'app',
  worktreePath: '/tmp/app/.goodboy/worktrees/goal',
  repoRoot: '/tmp/app',
  branch: 'goodboy/goal',
};

const webMount: SessionProjectMount = {
  projectId: web.id,
  mountName: 'web',
  worktreePath: '/tmp/web/.goodboy/worktrees/goal',
  repoRoot: '/tmp/web',
  branch: 'goodboy/goal-web',
};

const base = {
  containerDir: '/tmp/sessions/goal',
  workingDir: '/tmp/sessions/goal',
  isBridgeServing: false,
  isSessionDirScope: false,
  canWrite: true,
};

describe('buildScopeGuard', () => {
  it('teaches inventory, scouting, and the marker on a fresh session with zero mounts', () => {
    const guard = buildScopeGuard({ ...base, projects: [app, web], mounts: [] });

    expect(guard).toContain('[workspace-scope]');
    expect(guard).toContain('You are operating inside this session directory: /tmp/sessions/goal');
    expect(guard).toContain('- app (repo) root: /tmp/app | NOT materialized');
    expect(guard).toContain('- web (repo) root: /tmp/web | NOT materialized');
    expect(guard).toContain('You may READ the project root paths listed above.');
    expect(guard).toContain('No project is materialized yet');
    expect(guard).toContain('Do not create branches, worktrees, or clones for read-only work.');
    expect(guard).toContain('<<materialize: <project name> | <why you need it>>>');
    expect(guard).not.toContain('GOODBOY_BIN');
  });

  it('adds the bridge command variant to the single materialize line when serving', () => {
    const guard = buildScopeGuard({
      ...base,
      projects: [app, web],
      mounts: [],
      isBridgeServing: true,
    });

    const materializeLines = guard
      .split('\n')
      .filter((line) => line.includes('<<materialize:') || line.includes('GOODBOY_BIN'));
    expect(materializeLines).toHaveLength(1);
    expect(materializeLines[0]).toContain('query project materialize');
  });

  it('suppresses the materialize instruction for kinds that cannot write', () => {
    const guard = buildScopeGuard({ ...base, projects: [app, web], mounts: [], canWrite: false });

    expect(guard).toContain('NOT materialized');
    expect(guard).not.toContain('<<materialize:');
    expect(guard).not.toContain('GOODBOY_BIN');
  });

  it('keeps the inventory and marker after a mount while other projects stay unmounted', () => {
    const guard = buildScopeGuard({
      ...base,
      workingDir: appMount.worktreePath,
      projects: [app, web],
      mounts: [appMount],
    });

    expect(guard).toContain('[worktree-scope]');
    expect(guard).toContain(
      'You are operating inside an isolated git worktree at: /tmp/app/.goodboy/worktrees/goal',
    );
    expect(guard).toContain(
      '- app (repo) root: /tmp/app | materialized at /tmp/app/.goodboy/worktrees/goal',
    );
    expect(guard).toContain('- web (repo) root: /tmp/web | NOT materialized');
    expect(guard).toContain('<<materialize: <project name> | <why you need it>>>');
    expect(guard).not.toContain('No project is materialized yet');
  });

  it('keeps the mount inventory but drops the teaching once every project is mounted', () => {
    const guard = buildScopeGuard({
      ...base,
      workingDir: appMount.worktreePath,
      projects: [app],
      mounts: [appMount],
    });

    expect(guard).toContain('[worktree-scope]');
    expect(guard).toContain(
      '- app (repo) root: /tmp/app | materialized at /tmp/app/.goodboy/worktrees/goal (branch goodboy/goal)',
    );
    expect(guard).toContain('ALL file operations (Read/Write/Edit/Bash file paths)');
    expect(guard).not.toContain('NOT materialized');
    expect(guard).not.toContain('<<materialize:');
    expect(guard.split('\n')).toHaveLength(7);
  });

  it('lists every mount with its path and branch when every mount exists', () => {
    const guard = buildScopeGuard({
      ...base,
      projects: [app, web],
      mounts: [appMount, webMount],
    });

    expect(guard).toContain('[projects-scope]');
    expect(guard).toContain(
      'You are operating across 2 materialized project mounts from this session folder: /tmp/sessions/goal',
    );
    expect(guard).toContain('- app at /tmp/app/.goodboy/worktrees/goal (branch goodboy/goal)');
    expect(guard).toContain('- web at /tmp/web/.goodboy/worktrees/goal (branch goodboy/goal-web)');
    expect(guard).not.toContain('subfolder');
    expect(guard).toContain('ALL file operations MUST resolve inside one of these mounts.');
    expect(guard).not.toContain('NOT materialized');
    expect(guard.split('\n')).toHaveLength(7);
  });

  it('keeps the session-directory grammar for a mounted folder project', () => {
    const folder = buildProject({
      id: 'project-notes' as ProjectId,
      name: 'notes',
      rootPath: '/tmp/notes',
      kind: 'folder',
    });
    const folderMount: SessionProjectMount = {
      projectId: folder.id,
      mountName: 'notes',
      worktreePath: '/tmp/notes/goal',
      repoRoot: '/tmp/notes',
      branch: '',
    };
    const guard = buildScopeGuard({
      ...base,
      workingDir: folderMount.worktreePath,
      projects: [folder],
      mounts: [folderMount],
      isSessionDirScope: true,
    });

    expect(guard).toContain('[session-directory-scope]');
    expect(guard).toContain('You are operating inside this session directory: /tmp/notes/goal');
    expect(guard).toContain(
      '- notes (folder) root: /tmp/notes | materialized at /tmp/notes/goal (no branch)',
    );
    expect(guard).not.toContain('<<materialize:');
  });

  it('falls back to the strict worktree grammar for a session without projects', () => {
    const guard = buildScopeGuard({ ...base, workingDir: '/tmp/wt', projects: [], mounts: [] });

    expect(guard).toContain('[worktree-scope]');
    expect(guard).toContain('You are operating inside an isolated git worktree at: /tmp/wt');
    expect(guard).not.toContain('materialize');
  });
});
