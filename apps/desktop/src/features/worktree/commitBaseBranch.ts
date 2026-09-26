import type { ProjectId } from '@goodboy/types';

type UpdateProjectBaseBranch = (params: {
  readonly projectId: ProjectId;
  readonly baseBranch: string | null;
}) => Promise<unknown>;

type Params = {
  readonly projectId: ProjectId;
  readonly currentBaseBranch: string | null;
  readonly candidate: string | null;
  readonly updateProjectBaseBranch: UpdateProjectBaseBranch;
};

export const commitBaseBranch = async ({
  projectId,
  currentBaseBranch,
  candidate,
  updateProjectBaseBranch,
}: Params): Promise<void> => {
  const trimmed = candidate?.trim() ?? '';
  const nextBaseBranch = trimmed === '' ? null : trimmed;
  if (nextBaseBranch === currentBaseBranch) {
    return;
  }
  await updateProjectBaseBranch({ projectId, baseBranch: nextBaseBranch });
};
