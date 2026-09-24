import { useMemo, useState } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import type { Project, WorkspaceId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import type { ProjectAttachConflict } from '../../../store/slices/projects/addProject';
import { initRepo } from '../../lib/repo';
import { useChildRepoDetection } from '../useChildRepoDetection';
import { useProjectAdoption } from '../useProjectAdoption';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly initialConflicts?: ReadonlyArray<ProjectAttachConflict>;
};

const EMPTY_PROJECTS: ReadonlyArray<Project> = [];

const pickFolder = async (): Promise<string | null> => {
  const picked = await openDialog({ directory: true, multiple: false });
  if (typeof picked !== 'string' || picked.length === 0) {
    return null;
  }
  return picked;
};

export const useProjectLinking = ({ workspaceId, initialConflicts }: Params) => {
  const projects = useAppStore((state) => state.projects ?? EMPTY_PROJECTS);
  const addProject = useAppStore((state) => state.addProject);
  const addProjects = useAppStore((state) => state.addProjects);
  const removeProject = useAppStore((state) => state.removeProject);
  const { detected, detect, clear } = useChildRepoDetection();
  const [path, setPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const detectedPaths = useMemo(() => detected?.repos.map((repo) => repo.path) ?? [], [detected]);
  const adoption = useProjectAdoption({ workspaceId, detectedPaths, initialConflicts });

  const linked = useMemo(
    () => projects.filter((project) => project.workspaceId === workspaceId),
    [projects, workspaceId],
  );

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (actionError) {
      setError(formatError(actionError));
    } finally {
      setBusy(false);
    }
  };

  const linkPath = async ({
    rootPath,
    requireRepo,
  }: {
    readonly rootPath: string;
    readonly requireRepo: boolean;
  }) => {
    clear();
    if (requireRepo && (await detect({ path: rootPath }))) {
      return;
    }
    const result = await addProject({ workspaceId, rootPath, requireRepo });
    setPath('');
    if (result.kind === 'conflict') {
      adoption.noteConflicts([result.conflict]);
    }
  };

  const link = ({ rootPath }: { readonly rootPath: string }) =>
    run(() => linkPath({ rootPath, requireRepo: true }));

  const linkDetected = ({ paths }: { readonly paths: ReadonlyArray<string> }) =>
    run(async () => {
      const knownConflicts = paths.flatMap((entry) => {
        const conflict = adoption.knownConflicts[entry];
        return conflict === undefined ? [] : [conflict];
      });
      const freshPaths = paths.filter((entry) => adoption.knownConflicts[entry] === undefined);
      const result = await addProjects({ workspaceId, rootPaths: freshPaths });
      for (const conflict of knownConflicts) {
        await adoption.adoptConflict(conflict);
      }
      adoption.noteConflicts(result.conflicts);
      clear();
      setPath('');
    });

  const moveConflict = ({ conflict }: { readonly conflict: ProjectAttachConflict }) =>
    run(() => adoption.adoptConflict(conflict));

  const keepConflict = ({ conflict }: { readonly conflict: ProjectAttachConflict }) =>
    adoption.dismissConflict(conflict.project.id);

  const browse = async () => {
    const picked = await pickFolder();
    if (picked === null) {
      return;
    }
    setPath(picked);
  };

  const newProject = async () => {
    const picked = await pickFolder();
    if (picked === null) {
      return;
    }
    await run(async () => {
      const initialized = await initRepo({ path: picked });
      await linkPath({ rootPath: initialized.rootPath, requireRepo: true });
    });
  };

  const linkPlainFolder = async () => {
    const picked = await pickFolder();
    if (picked === null) {
      return;
    }
    await run(() => linkPath({ rootPath: picked, requireRepo: false }));
  };

  const unlink = ({ project }: { readonly project: Project }) =>
    run(() => removeProject({ projectId: project.id }));

  return {
    linked,
    path,
    setPath,
    busy,
    error,
    detected,
    dismissDetection: clear,
    knownRepos: adoption.knownRepos,
    conflicts: adoption.conflicts,
    link,
    linkDetected,
    moveConflict,
    keepConflict,
    browse,
    newProject,
    linkPlainFolder,
    unlink,
  };
};
