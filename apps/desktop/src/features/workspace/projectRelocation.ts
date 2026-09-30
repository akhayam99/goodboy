import { invokeCommand } from '../../shared/lib/invokeCommand';
import type { ProjectId } from '@goodboy/types';

export type ProjectRelocationResult = {
  readonly relocationId: string;
  readonly repairedGitLinks: boolean;
  readonly restoredSessionFolders: number;
};

type ProjectRelocateParams = {
  readonly relocationId: string;
  readonly projectId: ProjectId;
  readonly fromRoot: string;
  readonly toRoot: string;
};

export const projectRelocate = async ({
  relocationId,
  projectId,
  fromRoot,
  toRoot,
}: ProjectRelocateParams): Promise<ProjectRelocationResult> => {
  return invokeCommand<ProjectRelocationResult>('project_relocate', {
    args: { relocationId, projectId, fromRoot, toRoot },
  });
};

type ProjectRelocationUndoParams = {
  readonly relocationId: string;
};

export const projectRelocationUndo = async ({
  relocationId,
}: ProjectRelocationUndoParams): Promise<ProjectRelocationResult> => {
  return invokeCommand<ProjectRelocationResult>('project_relocation_undo', {
    args: { relocationId },
  });
};
