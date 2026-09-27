import type { Workflow } from '@goodboy/types';
import type { WorkflowBuilderDraft } from '../../../../store/slices/workflowDrafts/types';
import { draftFromWorkflow } from '../../../workflows/engine';

export type WorkflowStartChoice =
  | { readonly kind: 'preset'; readonly workflow: Workflow }
  | { readonly kind: 'custom' }
  | { readonly kind: 'orchestrated' };

type Params = {
  readonly choice: WorkflowStartChoice;
  readonly goal: string;
};

const BLANK_DRAFT: WorkflowBuilderDraft = {
  mode: 'custom',
  goalText: '',
  goalHistory: [],
  selectedPresetId: null,
  basePresetId: null,
  processText: '',
  plan: null,
  workflow: {
    name: '',
    description: '',
    goal: '',
    steps: [],
    origin: 'custom',
    isPreset: false,
  },
  saveAsPreset: false,
  autoRun: false,
  title: '',
  orchestratorModel: { providerOverride: '', modelOverride: '', effortOverride: null },
  providerPool: null,
};

export const builderDraftFor = ({ choice, goal }: Params): WorkflowBuilderDraft => {
  const base: WorkflowBuilderDraft = {
    ...BLANK_DRAFT,
    goalText: goal,
    workflow: { ...BLANK_DRAFT.workflow, goal },
  };
  switch (choice.kind) {
    case 'preset':
      return {
        ...base,
        mode: 'preset',
        selectedPresetId: choice.workflow.id,
        basePresetId: choice.workflow.id,
        workflow: {
          ...base.workflow,
          steps: draftFromWorkflow({ workflow: choice.workflow }).steps,
        },
      };
    case 'custom':
      return { ...base, mode: 'custom' };
    case 'orchestrated':
      return { ...base, mode: 'dynamic' };
    default: {
      const unreachable: never = choice;
      return unreachable;
    }
  }
};
