import type { WorkflowRunHistoryRow } from '@goodboy/db';
import {
  brandId,
  type Step,
  type StepId,
  type Workflow,
  type WorkflowId,
  type WorkflowRunId,
  type WorkspaceId,
} from '@goodboy/types';
import { nowIso } from '../../../../../store/slices/project-mounts/nowIso';
import type { AppStore } from '../../../../../store/store';
import { agoIso } from '../../scenes/demo/agoIso';
import { DEMO_RUN_SESSION } from '../../scenes/demo/demoRunSession';
import { demoRuns } from './demoRunRegistry';
import type { DirectorStore } from './directorTypes';

type Params = {
  readonly store: DirectorStore;
};

type Template = Parameters<AppStore['savePhaseTemplate']>[0];

type StepParams = {
  readonly workflowId: WorkflowId;
  readonly step: Template['steps'][number];
  readonly index: number;
};

type RowParams = {
  readonly workflow: Workflow;
};

type HistoryParams = {
  readonly workspaceId: WorkspaceId;
};

const OPEN_STUDIO_MS = 900;
const SOURCE_RUN_MINUTES_AGO = 18;
const SOURCE_RUN_COST_USD = 0.84;

const stepOf = ({ workflowId, step, index }: StepParams): Step => ({
  ...step,
  id: step.id ?? brandId<StepId>({ value: `${workflowId}-step-${index}` }),
  workflowId,
});

const sourceRunOf = ({ workflow }: RowParams): WorkflowRunHistoryRow => ({
  workflowRunId: brandId<WorkflowRunId>({ value: `${workflow.id}-source-run` }),
  workflowId: workflow.id,
  sessionId: DEMO_RUN_SESSION.id,
  sessionGoal: DEMO_RUN_SESSION.goal ?? workflow.name,
  isSessionArchived: false,
  executionMode: 'dynamic',
  orchestrationOutcome: 'done',
  createdAt: agoIso({ minutes: SOURCE_RUN_MINUTES_AGO }),
  stepCount: workflow.steps.length,
  startedSteps: workflow.steps.length,
  finishedSteps: workflow.steps.length,
  runningSteps: 0,
  failedSteps: 0,
  stoppedSteps: 0,
  costUsd: SOURCE_RUN_COST_USD,
});

export const installPresetActions = ({ store }: Params): void => {
  let runs: ReadonlyArray<WorkflowRunHistoryRow> = [];
  const showHistory = ({ workspaceId }: HistoryParams): void => {
    store.setState((state) => ({
      workflowRunHistory: {
        ...state.workflowRunHistory,
        [workspaceId]: {
          status: 'ready',
          runs,
          requestId: (state.workflowRunHistory[workspaceId]?.requestId ?? 0) + 1,
        },
      },
    }));
  };
  const savePhaseTemplate = (async (template) => {
    const at = nowIso({});
    const id = template.id ?? brandId<WorkflowId>({ value: `demo-preset-${Date.now()}` });
    const saved: Workflow = {
      id,
      workspaceId: template.workspaceId,
      name: template.name,
      description: template.description,
      ...(template.goal !== undefined && { goal: template.goal }),
      ...(template.processText !== undefined && { processText: template.processText }),
      steps: template.steps.map((step, index) => stepOf({ workflowId: id, step, index })),
      isPreset: template.isPreset ?? true,
      origin: template.origin ?? 'custom',
      createdAt: at,
      updatedAt: at,
    };
    runs = [...runs, sourceRunOf({ workflow: saved })];
    store.setState((state) => ({
      phaseTemplates: {
        ...state.phaseTemplates,
        [template.workspaceId]: [saved, ...(state.phaseTemplates[template.workspaceId] ?? [])],
      },
    }));
    showHistory({ workspaceId: template.workspaceId });
    let untrack = (): void => undefined;
    const timer = window.setTimeout(() => {
      untrack();
      store.getState().switchStudio({ studio: { kind: 'workflow' } });
    }, OPEN_STUDIO_MS);
    untrack = demoRuns.track({ cancel: () => window.clearTimeout(timer) });
    return saved;
  }) satisfies AppStore['savePhaseTemplate'];
  const loadWorkflowRunHistory: AppStore['loadWorkflowRunHistory'] = async ({ workspaceId }) => {
    showHistory({ workspaceId });
  };
  store.setState({ savePhaseTemplate, loadWorkflowRunHistory });
};
