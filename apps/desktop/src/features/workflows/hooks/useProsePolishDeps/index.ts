import { useMemo } from 'react';
import type { StepPolishDeps } from '@goodboy/core';
import type { WorkspaceId } from '@goodboy/types';
import { resolutionAsTask } from '../../../providers/resolutionAsTask';
import { useResolution } from '../../../providers/hooks/useResolution';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly workingDir: string | null;
};

export const useProsePolishDeps = ({
  workspaceId,
  workingDir,
}: Params): Omit<StepPolishDeps, 'invokeFn'> => {
  const resolution = useResolution({ task: 'prose_polish', workspaceId });
  const taskModel = useMemo(() => resolutionAsTask({ resolution }), [resolution]);
  return { ...taskModel, ...(workingDir !== null && { workingDir }) };
};
