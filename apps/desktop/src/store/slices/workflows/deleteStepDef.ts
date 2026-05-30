import type { StepDefId, WorkspaceId } from '@goodboy/types';
import { invokeStepDefDelete, invokeStepDefList } from '../../../features/workflows/workflows';
import type { SetFn } from './types';

// Soft-delete a library step. Workflows that already instanced it keep their copy
// (the instance carries its own fields), so existing presets are unaffected.
export function deleteStepDef(set: SetFn) {
  return async (id: StepDefId, listWorkspaceId: WorkspaceId) => {
    await invokeStepDefDelete(id);
    const defs = await invokeStepDefList(listWorkspaceId);
    set((state) => ({ stepLibrary: { ...state.stepLibrary, [listWorkspaceId]: defs } }));
  };
}
