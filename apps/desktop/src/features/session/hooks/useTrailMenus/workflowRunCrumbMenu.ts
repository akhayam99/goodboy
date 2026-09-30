import type { CrumbMenuModel } from '@goodboy/ui';
import type { WorkflowRunId } from '@goodboy/types';
import { openLens } from '../../openLens';
import { splitWorkflowRuns } from '../../../workflows/activeWorkflowRuns';
import { runMenu, type RunEntry } from '../../trail/menus/runMenu';
import { startWorkflowAction } from './trailMenuActions';
import type { TrailMenuScope } from './trailMenuScope';

export const workflowRunCrumbMenu = (scope: TrailMenuScope): CrumbMenuModel | null => {
  const { sessionId, phaseRuns, attachedRuns, selectedWorkflowRun, focusedWorkflowRunId } = scope;
  const { completed, discarded } = splitWorkflowRuns({ attachedRuns, agents: phaseRuns });
  const finishedIds = new Set([...completed, ...discarded].map(({ run }) => run.id));
  const runEntries: ReadonlyArray<RunEntry> = attachedRuns.map((entry) => ({
    ...entry,
    isFinished: finishedIds.has(entry.run.id),
  }));
  if (runEntries.length === 0) {
    return null;
  }
  return runMenu({
    runs: runEntries,
    agents: phaseRuns,
    currentRunId: selectedWorkflowRun?.run.id ?? (focusedWorkflowRunId as WorkflowRunId | null),
    nameOf: (entry) => scope.runTitleOf(entry),
    actions: [startWorkflowAction({ sessionId })],
    onSelect: (runId) => {
      scope.setFocusedWorkflowRun(sessionId, runId);
      openLens({ sessionId, lens: 'workflows' });
    },
  });
};
