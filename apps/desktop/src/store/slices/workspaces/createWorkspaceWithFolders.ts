import {
  brandId,
  type BootstrapPhase,
  type IsoDateTime,
  type OverrideSettings,
  type Project,
  type ProjectId,
  type Workspace,
  type WorkspaceId,
} from '@goodboy/types';
import { seedWorkflowLibrary } from '@goodboy/core';
import {
  describeProjectAdoption,
  findProjectByRootPath,
  getProjectById,
  getWorkspaceById,
  insertWorkspaceWithProjects,
} from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { CommandError } from '../../../shared/lib/invokeCommand';
import { initRepo, projectFolderCreate, validateGitRepo } from '../../../shared/lib/repo';
import { invokeWorkflowList } from '../../../features/workflows/workflows';
import {
  bootstrapPhaseKey,
  freshBootstrapPhase,
  serializeBootstrapPhase,
} from '../bootstrap/phase';
import { projectById } from '../projects/projectIndex';
import { refuseAdoptionWhileAgentsRun } from '../projects/refuseAdoptionWhileAgentsRun';
import { nowIso } from '../project-mounts/nowIso';
import { folderName, trimTrailingSeparators } from '../terminal/terminalOwner';
import { rescanWorkspaceSkills } from './workspaceSkills';
import { workspaceSlug } from './slug';
import type { GetFn, SetFn } from './types';

export type NewWorkspaceFolder =
  | {
      readonly kind: 'repository';
      readonly rootPath: string;
      readonly defaultBranch: string | null;
    }
  | { readonly kind: 'plain'; readonly rootPath: string }
  | { readonly kind: 'git-init'; readonly rootPath: string }
  | { readonly kind: 'scratch'; readonly parentPath: string; readonly name: string };

export type FolderMove = {
  readonly projectId: ProjectId;
  readonly fromWorkspaceId: WorkspaceId;
};

export type CreateWorkspaceWithFoldersParams = {
  readonly workspaceId: WorkspaceId;
  readonly name: string;
  readonly folders: ReadonlyArray<NewWorkspaceFolder>;
  readonly moves: ReadonlyArray<FolderMove>;
};

export type CreatedWorkspace = {
  readonly workspace: Workspace;
  readonly projects: ReadonlyArray<Project>;
  readonly movedSessionCount: number;
};

type PreparedFolder = {
  readonly rootPath: string;
  readonly kind: Project['kind'];
  readonly baseBranch: string | null;
  readonly isScratch: boolean;
};

const EMPTY_OVERRIDES: OverrideSettings = {
  defaultProviderId: null,
  defaultBranchPrefix: null,
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
  afterMerge: null,
  defaultBranchTemplate: null,
};

const ALREADY_EXISTS = 'already_exists';

type ScratchParams = {
  readonly parentPath: string;
  readonly name: string;
};

const resumeScratchFolder = async ({
  parentPath,
  name,
}: ScratchParams): Promise<PreparedFolder> => {
  const path = `${trimTrailingSeparators({ path: parentPath })}/${name}`;
  const check = await validateGitRepo(path);
  if (!check.isRepo || check.rootPath === null || check.rootPath !== check.resolvedPath) {
    throw new Error(`${name} already exists in ${parentPath}. Pick another name.`);
  }
  return {
    rootPath: check.rootPath,
    kind: 'repo',
    baseBranch: check.defaultBranch,
    isScratch: true,
  };
};

const createScratchFolder = async ({
  parentPath,
  name,
}: ScratchParams): Promise<PreparedFolder> => {
  const trimmed = name.trim();
  try {
    const created = await projectFolderCreate({ parentPath, name: trimmed });
    return {
      rootPath: created.rootPath,
      kind: 'repo',
      baseBranch: created.branch,
      isScratch: true,
    };
  } catch (error) {
    if (error instanceof CommandError && error.kind === ALREADY_EXISTS) {
      return resumeScratchFolder({ parentPath, name: trimmed });
    }
    throw error;
  }
};

type PrepareParams = {
  readonly folder: NewWorkspaceFolder;
};

const prepareFolder = async ({ folder }: PrepareParams): Promise<PreparedFolder> => {
  switch (folder.kind) {
    case 'repository':
      return {
        rootPath: folder.rootPath,
        kind: 'repo',
        baseBranch: folder.defaultBranch,
        isScratch: false,
      };
    case 'plain':
      return { rootPath: folder.rootPath, kind: 'folder', baseBranch: null, isScratch: false };
    case 'git-init': {
      const initialized = await initRepo({ path: folder.rootPath });
      return {
        rootPath: initialized.rootPath,
        kind: 'repo',
        baseBranch: initialized.branch,
        isScratch: false,
      };
    }
    case 'scratch':
      return createScratchFolder({ parentPath: folder.parentPath, name: folder.name });
    default: {
      const unreachable: never = folder;
      return unreachable;
    }
  }
};

type CheckMoveParams = {
  readonly get: GetFn;
  readonly move: FolderMove;
};

const checkMove = async ({ get, move }: CheckMoveParams): Promise<void> => {
  const project =
    projectById(get().projects, move.projectId) ??
    (await getProjectById({ db: tauriDatabase, id: move.projectId }));
  if (project === null || project === undefined) {
    throw new Error(`folder not found: ${move.projectId}`);
  }
  if (project.workspaceId !== move.fromWorkspaceId) {
    throw new Error(
      `${project.name} moved to another workspace since you picked it. Pick it again.`,
    );
  }
  const info = await describeProjectAdoption({ db: tauriDatabase, projectId: project.id });
  if (info === null) {
    throw new Error(`folder not found: ${move.projectId}`);
  }
  await refuseAdoptionWhileAgentsRun({ get, project, info });
};

type ExistingRowParams = {
  readonly get: GetFn;
  readonly workspaceId: WorkspaceId;
  readonly rootPath: string;
};

const existingRowFor = async ({
  get,
  workspaceId,
  rootPath,
}: ExistingRowParams): Promise<Project | null> => {
  const existing = await findProjectByRootPath({ db: tauriDatabase, rootPath });
  if (existing === null || existing.workspaceId === workspaceId) {
    return existing;
  }
  const owner =
    get().workspaces.find((workspace) => workspace.id === existing.workspaceId) ??
    (await getWorkspaceById({ db: tauriDatabase, id: existing.workspaceId }));
  throw new Error(
    `${existing.name} is already in ${owner?.name ?? 'another workspace'}. Move it here instead.`,
  );
};

type NewRowParams = {
  readonly workspaceId: WorkspaceId;
  readonly folder: PreparedFolder;
  readonly now: IsoDateTime;
};

const newProjectRow = ({ workspaceId, folder, now }: NewRowParams): Project => ({
  id: brandId<ProjectId>({ value: crypto.randomUUID() }),
  workspaceId,
  name: folderName({ path: folder.rootPath }) ?? folder.rootPath,
  rootPath: folder.rootPath,
  kind: folder.kind,
  baseBranch: folder.baseBranch,
  overrides: EMPTY_OVERRIDES,
  createdAt: now,
  updatedAt: now,
  lastAccessedAt: now,
});

type FirstLap = {
  readonly projectId: ProjectId;
  readonly phase: BootstrapPhase;
};

export const createWorkspaceWithFolders = (set: SetFn, get: GetFn) => {
  return async ({
    workspaceId,
    name,
    folders,
    moves,
  }: CreateWorkspaceWithFoldersParams): Promise<CreatedWorkspace> => {
    const trimmedName = name.trim();
    if (trimmedName === '') {
      throw new Error('workspace name is required');
    }
    if (folders.length === 0 && moves.length === 0) {
      throw new Error('pick a folder for the workspace');
    }
    for (const move of moves) {
      await checkMove({ get, move });
    }
    for (const folder of folders) {
      if (folder.kind !== 'scratch') {
        await existingRowFor({ get, workspaceId, rootPath: folder.rootPath });
      }
    }

    const prepared: PreparedFolder[] = [];
    for (const folder of folders) {
      prepared.push(await prepareFolder({ folder }));
    }

    const now = nowIso({});
    const storedWorkspace =
      get().workspaces.find((workspace) => workspace.id === workspaceId) ??
      (await getWorkspaceById({ db: tauriDatabase, id: workspaceId }));
    const isNewWorkspace = storedWorkspace === null || storedWorkspace === undefined;
    const workspace: Workspace = storedWorkspace ?? {
      id: workspaceId,
      name: trimmedName,
      slug: workspaceSlug({ name: trimmedName, id: workspaceId }),
      overrides: EMPTY_OVERRIDES,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
    };

    const kept: Project[] = [];
    const inserted: Project[] = [];
    const firstLaps: FirstLap[] = [];
    for (const folder of prepared) {
      if ([...kept, ...inserted].some((row) => row.rootPath === folder.rootPath)) {
        continue;
      }
      const existing = await existingRowFor({ get, workspaceId, rootPath: folder.rootPath });
      if (existing !== null) {
        kept.push(existing);
        continue;
      }
      const project = newProjectRow({ workspaceId, folder, now });
      inserted.push(project);
      if (folder.isScratch) {
        firstLaps.push({ projectId: project.id, phase: freshBootstrapPhase(now) });
      }
    }

    await insertWorkspaceWithProjects({
      db: tauriDatabase,
      workspace: isNewWorkspace ? workspace : null,
      projects: inserted,
      settings: firstLaps.map(({ projectId, phase }) => ({
        key: bootstrapPhaseKey(projectId),
        value: serializeBootstrapPhase(phase),
      })),
    });

    const projects = [...kept, ...inserted];
    const projectIds = new Set<ProjectId>(projects.map((project) => project.id));
    const phases = Object.fromEntries(firstLaps.map(({ projectId, phase }) => [projectId, phase]));
    set((state) => ({
      workspaces: [workspace, ...state.workspaces.filter((item) => item.id !== workspaceId)],
      projects: [...projects, ...state.projects.filter((item) => !projectIds.has(item.id))],
      bootstrapPhase: { ...state.bootstrapPhase, ...phases },
    }));

    if (isNewWorkspace) {
      await seedWorkflowLibrary({ db: tauriDatabase }, workspaceId).catch((error: unknown) =>
        get().reportError({ title: 'Workflows were not added', error, workspaceId }),
      );
      const templates = await invokeWorkflowList(workspaceId).catch(() => []);
      set((state) => ({ phaseTemplates: { ...state.phaseTemplates, [workspaceId]: templates } }));
      const skills = await rescanWorkspaceSkills(workspaceId);
      set((state) => ({ skills: { ...state.skills, [workspaceId]: skills } }));
    }

    let movedSessionCount = 0;
    for (const move of moves) {
      const result = await get().adoptProject({
        projectId: move.projectId,
        targetWorkspaceId: workspaceId,
      });
      movedSessionCount += result.movedSessionCount;
    }

    return { workspace, projects, movedSessionCount };
  };
};
