import type { StepDef, WorkspaceId } from '@goodboy/types';
import {
  invokeStepDefList,
  invokeStepDefUpsert,
  type StepDefUpsertArgs,
} from '../../../features/workflows/workflows';
import type { SetFn } from './types';

export const saveStepDef = (set: SetFn) => {
  return async (args: StepDefUpsertArgs, listWorkspaceId: WorkspaceId): Promise<StepDef> => {
    const saved = await invokeStepDefUpsert(args);
    const defs = await invokeStepDefList(listWorkspaceId);
    set((state) => ({ stepLibrary: { ...state.stepLibrary, [listWorkspaceId]: defs } }));
    return saved;
  };
};
