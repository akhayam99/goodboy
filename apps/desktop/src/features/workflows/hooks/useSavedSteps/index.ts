import { useMemo } from 'react';
import type { StepDef, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { savedStepGroups, type SavedStepGroups } from '../../savedSteps';

type Params = {
  readonly workspaceId: WorkspaceId;
};

export const useSavedSteps = ({ workspaceId }: Params): SavedStepGroups => {
  const defs = useAppStore(
    (state) => state.stepLibrary[workspaceId] ?? (EMPTY_ARRAY as ReadonlyArray<StepDef>),
  );
  return useMemo(() => savedStepGroups({ defs }), [defs]);
};
