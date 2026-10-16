import { useEffect, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { WorkflowStudio } from '../../../../../../features/workflows/components/WorkflowStudio';
import { useAppStore } from '../../../../../../store';
import type { WorkflowRunHistoryLoad } from '../../../../../../store/slices/workflowStudio/types';
import { useSceneClicks } from '../../audit/useSceneClicks';
import {
  C13_HISTORY,
  C13_WORKFLOWS,
  C13_WORKSPACE,
  C13_WORKSPACE_ID,
  FIX_A_BUG,
} from './workflowsSceneSeed';

type WorkflowsSceneState =
  'list' | 'history' | 'history-empty' | 'history-failed' | 'history-filter';

type Props = {
  readonly state: WorkflowsSceneState;
};

const noop = () => undefined;

const CLICK_MS = 250;

const clickLabelsOf = ({ state }: Props): ReadonlyArray<string> => {
  switch (state) {
    case 'list':
      return [];
    case 'history':
    case 'history-failed':
      return ['Runs of Fix flaky tests'];
    case 'history-empty':
      return ['Runs of Lint and type check'];
    case 'history-filter':
      return [`Runs of ${FIX_A_BUG?.name ?? 'Fix a bug'}`];
    default: {
      const unreachable: never = state;
      return unreachable;
    }
  }
};

const loadOf = ({ state }: Props): WorkflowRunHistoryLoad =>
  state === 'history-failed'
    ? { status: 'failed', runs: null, requestId: 1 }
    : { status: 'ready', runs: C13_HISTORY, requestId: 1 };

type SeedParams = Props & {
  readonly workspaceId: WorkspaceId;
};

const seed = ({ state, workspaceId }: SeedParams): void => {
  const load = loadOf({ state });
  useAppStore.setState({
    workspaces: [C13_WORKSPACE],
    currentWorkspaceId: workspaceId,
    phaseTemplates: { [workspaceId]: C13_WORKFLOWS },
    stepLibrary: { [workspaceId]: [] },
    workflowStudioView: 'workflows',
    loadPhaseTemplates: async () => undefined,
    loadStepLibrary: async () => undefined,
    setWorkflowStudioVisible: noop,
    workflowRunHistory: { [workspaceId]: load },
    loadWorkflowRunHistory: async () => {
      useAppStore.setState((current) => ({
        workflowRunHistory: { ...current.workflowRunHistory, [workspaceId]: load },
      }));
    },
  });
};

export const WorkflowsScene = ({ state }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seed({ state, workspaceId: C13_WORKSPACE_ID });
    setIsReady(true);
  }, [state]);

  useSceneClicks({
    isReady,
    labels: clickLabelsOf({ state }),
    selector: 'button',
    match: 'prefix',
    intervalMs: CLICK_MS,
  });

  if (!isReady) {
    return null;
  }

  return <WorkflowStudio workspaceId={C13_WORKSPACE_ID} onClose={noop} />;
};
