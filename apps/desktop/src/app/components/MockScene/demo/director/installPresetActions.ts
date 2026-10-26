import { brandId, type Step, type StepId, type Workflow, type WorkflowId } from '@goodboy/types';
import { nowIso } from '../../../../../store/slices/project-mounts/nowIso';
import type { AppStore } from '../../../../../store/store';
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

const OPEN_STUDIO_MS = 900;

const stepOf = ({ workflowId, step, index }: StepParams): Step => ({
  ...step,
  id: step.id ?? brandId<StepId>({ value: `${workflowId}-step-${index}` }),
  workflowId,
});

export const installPresetActions = ({ store }: Params): void => {
  const savePhaseTemplate: AppStore['savePhaseTemplate'] = async (template) => {
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
    store.setState((state) => ({
      phaseTemplates: {
        ...state.phaseTemplates,
        [template.workspaceId]: [saved, ...(state.phaseTemplates[template.workspaceId] ?? [])],
      },
    }));
    let untrack = (): void => undefined;
    const timer = window.setTimeout(() => {
      untrack();
      store.getState().switchStudio({ studio: { kind: 'workflow' } });
    }, OPEN_STUDIO_MS);
    untrack = demoRuns.track({ cancel: () => window.clearTimeout(timer) });
    return saved;
  };
  store.setState({ savePhaseTemplate });
};
