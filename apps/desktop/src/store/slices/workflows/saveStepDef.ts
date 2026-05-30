import type { WorkspaceId } from '@goodboy/types';
import {
  invokeStepDefList,
  invokeStepDefUpsert,
  type StepDefUpsertArgs,
} from '../../../features/workflows/workflows';
import type { SetFn } from './types';

// Persists a library step (StepDef) and reloads the effective library for the
// workspace. `args.workspaceId === null` writes a global definition; a non-null
// workspaceId with `baseStepId` set writes a workspace override of a global one.
export function saveStepDef(set: SetFn) {
  return async (args: StepDefUpsertArgs, listWorkspaceId: WorkspaceId) => {
    await invokeStepDefUpsert(args);
    const defs = await invokeStepDefList(listWorkspaceId);
    set((state) => ({ stepLibrary: { ...state.stepLibrary, [listWorkspaceId]: defs } }));
  };
}
