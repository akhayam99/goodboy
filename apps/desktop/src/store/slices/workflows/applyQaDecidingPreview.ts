import { invoke } from '@tauri-apps/api/core';
import type { SetFn } from './types';

type Params = {
  readonly set: SetFn;
};

export const applyQaDecidingPreview = async ({ set }: Params): Promise<void> => {
  const runIds = await invoke<ReadonlyArray<string>>('qa_deciding_workflow_runs');
  if (runIds.length === 0) {
    return;
  }
  const seeded: Record<string, boolean> = {};
  for (const runId of runIds) {
    seeded[runId] = true;
  }
  set((state) => ({
    orchestratingWorkflowRuns: { ...state.orchestratingWorkflowRuns, ...seeded },
  }));
};
