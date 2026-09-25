import { describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  MountId,
  Project,
  ProjectId,
  SessionId,
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
    attributionFooter: null,
    replyVoice: null,
    replyStyleNote: null,
    replyTemplateFixed: null,
    replyTemplateNoChange: null,
    resolveOnGithub: null,
    resolveCommitStyle: null,
  },
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

const app = buildProject();
const web = buildProject({ id: 'project-web' as ProjectId, name: 'web', rootPath: '/tmp/web' });

const appMount: SessionProjectMount = {
  mountId: 'mount-app' as MountId,
  projectId: app.id,
  mountName: 'app',
  worktreePath: '/tmp/app/.goodboy/worktrees/goal',
  repoRoot: '/tmp/app',
  branch: 'goodboy/goal',
  sessionId: 'session-fixture' as SessionId,
  lastWorktreePath: null,
  baseBranch: null,
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 0,
};

const appFork: SessionProjectMount = {
  ...appMount,
  mountId: 'mount-app-2' as MountId,
  mountName: 'app 2',
  worktreePath: '/tmp/app/.goodboy/worktrees/goal-2',
  branch: 'goodboy/goal-2',
};

const webMount: SessionProjectMount = {
  mountId: 'mount-web' as MountId,
  projectId: web.id,
  mountName: 'web',
  worktreePath: '/tmp/web/.goodboy/worktrees/goal',
  repoRoot: '/tmp/web',
  branch: 'goodboy/goal-web',
  sessionId: 'session-fixture' as SessionId,
  lastWorktreePath: null,
  baseBranch: null,
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 0,
};

const base = {
  workingDir: appMount.worktreePath,
  isBridgeServing: false,
  isSessionDirScope: false,
  canWrite: true,
};

const READING_ENTITLEMENT =
  'You may read and search every project listed in this workspace to answer the current request. This permission is already granted and needs no mount, no activation and no confirmation.';
const READING_NOT_LIMITED =
  'Your starting directory and your bound mount do not limit which listed projects you may inspect.';
const READING_IS_ORDINARY =
  'Reading another listed project is ordinary workspace work. Name the source you used, and do not describe the read as a scope exception.';
const READING_STAYS_ON_TASK =
  'Stay on the assigned task. Workspace membership does not authorize unrelated exploration or access to locations that are not listed.';
const READING_REVISIONS =
  'A project root and a session mount can hold different revisions. Use the one the question is about and say which one you used.';
const WRITE_BOUNDARY =
  'ALL writes (Write/Edit/Bash file mutations) MUST resolve inside the session directory or a materialized project mount.';
const READ_ONLY_ROLE =
  'Your role covers inspection and analysis across the listed workspace projects. It does not cover changing project files or requesting a writable mount.';

type MatrixCase = {
  readonly name: string;
  readonly projects: ReadonlyArray<Project>;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
};

const MATRIX: ReadonlyArray<MatrixCase> = [
  { name: 'no mount and every project unmounted', projects: [app, web], mounts: [] },
  { name: 'one mount and an unmounted sibling project', projects: [app, web], mounts: [appMount] },
  { name: 'one mount and every project mounted', projects: [app], mounts: [appMount] },
  {
    name: 'two mounts and every project mounted',
    projects: [app, web],
    mounts: [appMount, webMount],
  },
  {
    name: 'two mounts of one project and an unmounted sibling',
    projects: [app, web],
    mounts: [appMount, appFork],
  },
];

const SCRATCH_DIR = '/tmp/goodboy-root/scratch/session-1';

const guardFor = ({
  entry,
  canWrite,
}: {
  readonly entry: MatrixCase;
  readonly canWrite: boolean;
}): string =>
  buildScopeGuard({
    ...base,
    canWrite,
    workingDir: entry.mounts[0]?.worktreePath ?? SCRATCH_DIR,
    projects: entry.projects,
    mounts: entry.mounts,
  });

describe('buildScopeGuard reading entitlement', () => {
  for (const entry of MATRIX) {
    it(`grants reading to a writer kind with ${entry.name}`, () => {
      const guard = guardFor({ entry, canWrite: true });

      expect(guard).toContain(READING_ENTITLEMENT);
      expect(guard).toContain(READING_NOT_LIMITED);
      expect(guard).toContain(READING_IS_ORDINARY);
      expect(guard).toContain(READING_STAYS_ON_TASK);
      expect(guard).toContain(READING_REVISIONS);
      expect(guard).toContain('This session belongs to a workspace with these projects:');
      for (const project of entry.projects) {
        expect(guard).toContain(`- ${project.name} (repo) root: ${project.rootPath}`);
      }
      expect(guard).not.toContain('ALL file operations');
    });

    it(`grants the same reading to a read-only kind with ${entry.name}`, () => {
      const guard = guardFor({ entry, canWrite: false });

      expect(guard).toContain(READING_ENTITLEMENT);
      expect(guard).toContain(READING_NOT_LIMITED);
      expect(guard).toContain(READING_IS_ORDINARY);
      expect(guard).toContain(READING_STAYS_ON_TASK);
      expect(guard).toContain(READING_REVISIONS);
      expect(guard).toContain('This session belongs to a workspace with these projects:');
      expect(guard).not.toContain('ALL file operations');
    });
  }
});

describe('buildScopeGuard write boundary', () => {
  for (const entry of MATRIX) {
    it(`keeps the write boundary and the marker for a writer kind with ${entry.name}`, () => {
      const guard = guardFor({ entry, canWrite: true });

      expect(guard).toContain(WRITE_BOUNDARY);
      expect(guard).toContain('<<materialize: <project name> | <why you need it>>>');
      expect(guard).toContain(
        'Materialize ONLY a project whose files you must edit. A project name in the goal, plan, or prompt is not write intent or authorization.',
      );
      expect(guard).not.toContain(READ_ONLY_ROLE);
    });

    it(`withholds both from a read-only kind with ${entry.name}`, () => {
      const guard = guardFor({ entry, canWrite: false });

      expect(guard).toContain(READ_ONLY_ROLE);
      expect(guard).not.toContain(WRITE_BOUNDARY);
      expect(guard).not.toContain('<<materialize:');
      expect(guard).not.toContain('Materialize ONLY a project');
      expect(guard).not.toContain('GOODBOY_BIN');
    });
  }
});

describe('buildScopeGuard', () => {
  it('teaches the inventory and the marker while another project stays unmounted', () => {
    const guard = buildScopeGuard({ ...base, projects: [app, web], mounts: [appMount] });

    expect(guard).toContain('[worktree-scope]');
    expect(guard).toContain(
      'You are operating inside an isolated git worktree at: /tmp/app/.goodboy/worktrees/goal',
    );
    expect(guard).toContain(
      '- app (repo) root: /tmp/app | materialized at /tmp/app/.goodboy/worktrees/goal',
    );
    expect(guard).toContain(
      '- web (repo) root: /tmp/web | NOT materialized: read it freely, mount it only to write',
    );
    expect(guard).toContain(
      'NEVER materialize a project to read it, to run its tests, or because it looks related to the goal. Reading needs no mount.',
    );
    expect(guard).toContain(
      'The active project, projects linked by external tasks, and existing mounts are authorized. Up to two other projects mount automatically per session; further projects wait for owner approval.',
    );
    expect(guard).not.toContain('materialize every relevant project');
    expect(guard).toContain('<<materialize: <project name> | <why you need it>>>');
    expect(guard).toContain(
      'After emitting the marker, end your turn. The mount is ready on the next one.',
    );
    expect(guard).not.toContain('GOODBOY_BIN');
  });

  it('puts the reading entitlement before the execution context', () => {
    const guard = buildScopeGuard({ ...base, projects: [app, web], mounts: [appMount] });
    const lines = guard.split('\n');

    expect(lines.indexOf(READING_ENTITLEMENT)).toBeGreaterThan(-1);
    expect(lines.indexOf(READING_ENTITLEMENT)).toBeLessThan(
      lines.findIndex((line) => line.startsWith('You are operating inside')),
    );
    expect(lines.indexOf(READING_ENTITLEMENT)).toBeLessThan(
      lines.findIndex((line) => line.startsWith('This process starts in')),
    );
    expect(lines.indexOf(READING_ENTITLEMENT)).toBeLessThan(
      lines.findIndex((line) => line.startsWith(WRITE_BOUNDARY)),
    );
  });

  it('adds the bridge command variant to the single materialize line when serving', () => {
    const guard = buildScopeGuard({
      ...base,
      projects: [app, web],
      mounts: [appMount],
      isBridgeServing: true,
    });

    const materializeLines = guard
      .split('\n')
      .filter((line) => line.includes('<<materialize:') || line.includes('query project'));
    expect(materializeLines).toHaveLength(1);
    expect(materializeLines[0]).toContain('query project materialize');
    expect(guard).not.toContain('After emitting the marker, end your turn.');
  });

  it('names the mount verbs on one line once a mount exists and the bridge serves', () => {
    const guard = buildScopeGuard({
      ...base,
      projects: [app],
      mounts: [appMount],
      isBridgeServing: true,
    });

    const lines = guard.split('\n').filter((line) => line.includes('query mount list'));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('mount fork');
    expect(lines[0]).toContain('mount switch');
  });

  it('says nothing about mount verbs while the bridge is silent', () => {
    const guard = buildScopeGuard({ ...base, projects: [app], mounts: [appMount] });

    expect(guard).not.toContain('query mount list');
  });

  it('keeps the inventory and the reading entitlement once every project is mounted', () => {
    const guard = buildScopeGuard({ ...base, projects: [app], mounts: [appMount] });

    expect(guard).toContain('[worktree-scope]');
    expect(guard).toContain(
      '- app (repo) root: /tmp/app | materialized at /tmp/app/.goodboy/worktrees/goal (branch goodboy/goal)',
    );
    expect(guard).toContain(READING_ENTITLEMENT);
    expect(guard).toContain(WRITE_BOUNDARY);
    expect(guard).not.toContain('ALL file operations (Read/Write/Edit/Bash file paths)');
    expect(guard).not.toContain('NOT materialized');
  });

  it('names the active mount as the working directory and lists the others', () => {
    const guard = buildScopeGuard({
      ...base,
      workingDir: webMount.worktreePath,
      projects: [app, web],
      mounts: [appMount, webMount],
    });

    expect(guard).toContain('[projects-scope]');
    expect(guard).toContain(
      'You are operating inside the active project mount at: /tmp/web/.goodboy/worktrees/goal',
    );
    expect(guard).toContain('This session has 2 materialized project mounts:');
    expect(guard).toContain(
      '- app [mount mount-app] project app branch goodboy/goal at /tmp/app/.goodboy/worktrees/goal (attached)',
    );
    expect(guard).toContain(
      '- web [mount mount-web] project web branch goodboy/goal-web at /tmp/web/.goodboy/worktrees/goal (attached)',
    );
    expect(guard).toContain(WRITE_BOUNDARY);
    expect(guard).not.toContain('ALL file operations MUST resolve inside one of these mounts.');
    expect(guard).not.toContain('NOT materialized');
  });

  it('renders two mounts of one project as worktrees of one repository', () => {
    const guard = buildScopeGuard({
      ...base,
      projects: [app],
      mounts: [appMount, appFork],
      activeMountId: appMount.mountId ?? null,
    });

    expect(guard).toContain(
      '- app [mount mount-app] project app branch goodboy/goal at /tmp/app/.goodboy/worktrees/goal (attached)',
    );
    expect(guard).toContain(
      '- app 2 [mount mount-app-2] project app branch goodboy/goal-2 at /tmp/app/.goodboy/worktrees/goal-2 (attached)',
    );
    expect(guard).toContain(
      'Two mounts of the same project are worktrees of one repository and share its history and its remotes, they are not separate clones.',
    );
    expect(guard).not.toContain('separate git repository');
  });

  it('frames the starting directory and the bound mount as execution context', () => {
    const guard = buildScopeGuard({
      ...base,
      projects: [app],
      mounts: [appMount],
      activeMountId: appMount.mountId ?? null,
    });

    expect(guard).toContain(
      'This process starts in /tmp/app/.goodboy/worktrees/goal and is bound to mount mount-app. That fixes where it runs for this turn. Activating another mount changes where a later turn starts.',
    );
  });

  it('drops the mount half of the execution line when no mount is active', () => {
    const guard = buildScopeGuard({ ...base, projects: [app], mounts: [appMount] });

    expect(guard).toContain(
      'This process starts in /tmp/app/.goodboy/worktrees/goal. That fixes where it runs for this turn.',
    );
    expect(guard).not.toContain('is bound to mount');
  });

  it('marks a mount that is no longer attached or no longer on disk', () => {
    const guard = buildScopeGuard({
      ...base,
      projects: [app],
      mounts: [
        { ...appMount, isAttached: false },
        { ...appFork, diskState: 'missing' },
      ],
    });

    expect(guard).toContain('at /tmp/app/.goodboy/worktrees/goal (detached)');
    expect(guard).toContain('at /tmp/app/.goodboy/worktrees/goal-2 (attached, directory missing)');
  });

  it('teaches fork, switch and the mount-scoped request commands while the bridge serves', () => {
    const guard = buildScopeGuard({
      ...base,
      projects: [app],
      mounts: [appMount],
      isBridgeServing: true,
    });

    expect(guard).toContain(
      'Before you begin an independent pull request line, run `mount fork --mount <id> --branch <name>`.',
    );
    expect(guard).toContain('starts from the configured origin base unless you pass `--base');
    expect(guard).toContain('cherry-pick what belongs there and resolve conflicts normally');
    expect(guard).toContain(
      'Use `mount switch --mount <id> --branch <name>` only when you intend to replace THIS mount current branch.',
    );
    expect(guard).toContain('"$GOODBOY_BIN" query github pr-create --mount <id>');
    expect(guard).toContain('NEVER use a raw `git checkout -b` as a way of declaring a fork.');
  });

  it('frames a mountless turn as projects-scope with every project unmounted', () => {
    const guard = buildScopeGuard({
      ...base,
      workingDir: SCRATCH_DIR,
      projects: [app, web],
      mounts: [],
    });

    expect(guard).toContain('[projects-scope]');
    expect(guard).toContain(
      'You are operating from an ephemeral scratch directory at: /tmp/goodboy-root/scratch/session-1',
    );
    expect(guard).toContain('This session has no materialized project mounts yet.');
    expect(guard).toContain('- app (repo) root: /tmp/app | NOT materialized');
    expect(guard).toContain('- web (repo) root: /tmp/web | NOT materialized');
    expect(guard).toContain(READING_ENTITLEMENT);
    expect(guard).toContain(WRITE_BOUNDARY);
    expect(guard).toContain('<<materialize: <project name> | <why you need it>>>');
    expect(guard).not.toContain('materialized at');
    expect(guard).not.toContain('isolated git worktree');
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
      worktreePath: '/tmp/notes/sessions/goal',
      repoRoot: '/tmp/notes',
      branch: '',
      mountId: 'mount-fixture-1' as MountId,
      sessionId: 'session-fixture' as SessionId,
      lastWorktreePath: null,
      baseBranch: null,
      parallelIndex: 0,
      isAttached: true,
      diskState: 'present',
      revision: 0,
    };
    const guard = buildScopeGuard({
      ...base,
      workingDir: folderMount.worktreePath,
      projects: [folder],
      mounts: [folderMount],
      isSessionDirScope: true,
    });

    expect(guard).toContain('[session-directory-scope]');
    expect(guard).toContain(
      'You are operating inside this session directory: /tmp/notes/sessions/goal',
    );
    expect(guard).toContain(
      '- notes (folder) root: /tmp/notes | materialized at /tmp/notes/sessions/goal (no branch)',
    );
    expect(guard).toContain(READING_ENTITLEMENT);
  });
});
