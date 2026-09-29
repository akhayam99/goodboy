import { useEffect } from 'react';
import type { IsoDateTime, ProjectId, StepId, Workflow, WorkflowId } from '@goodboy/types';
import { EMPTY_SESSION_DRAFT } from '../../../../../store/slices/sessionDraft/state';
import { useAppStore } from '../../../../../store';
import { WORKSPACE_ID } from '../BoardScene';
import { BrandKickoffScene } from '../brand/KickoffScene';
import { BRAND_SESSION } from '../brand/canon';

const CREATED = '2026-09-25T09:00:00.000Z' as IsoDateTime;

type PresetParams = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly steps: ReadonlyArray<string>;
};

const presetOf = ({ id, name, description, steps }: PresetParams): Workflow => ({
  id: id as WorkflowId,
  workspaceId: WORKSPACE_ID,
  name,
  description,
  isPreset: true,
  origin: 'library',
  createdAt: CREATED,
  updatedAt: CREATED,
  steps: steps.map((stepName, ordinal) => ({
    id: `${id}-step-${ordinal}` as StepId,
    workflowId: id as WorkflowId,
    ordinal,
    name: stepName,
    role: 'custom',
    promptPrefix: stepName,
  })),
});

const PRESETS: ReadonlyArray<Workflow> = [
  presetOf({
    id: 'mock-features-start-fix-bug',
    name: 'Fix a bug',
    description: 'Reproduce it, fix it, prove it stays fixed.',
    steps: ['Reproduce', 'Fix', 'Add a regression test', 'Review'],
  }),
  presetOf({
    id: 'mock-features-start-ship-feature',
    name: 'Ship a feature',
    description: 'Plan, build, test and review a change end to end.',
    steps: ['Plan', 'Implement', 'Test', 'Review', 'Open the pull request'],
  }),
];

const paramOf = (): string | null => new URLSearchParams(window.location.search).get('tab');

const seedTab = (): void => {
  const tab = paramOf();
  if (tab !== 'workflow' && tab !== 'scout') {
    return;
  }
  useAppStore.setState((state) => ({
    phaseTemplates: { ...state.phaseTemplates, [WORKSPACE_ID]: PRESETS },
    loadPhaseTemplates: async () => undefined,
    sessionDrafts: {
      [WORKSPACE_ID]: {
        ...EMPTY_SESSION_DRAFT,
        choice: tab,
        workflowGoal: tab === 'workflow' ? BRAND_SESSION.title : '',
        agentPrompt: tab === 'scout' ? 'How does a retried webhook reach the ledger?' : '',
        projectId: 'mock-board-project-payments-api' as ProjectId,
      },
    },
  }));
};

export const FeaturesStartTabsScene = () => {
  useEffect(() => {
    seedTab();
  }, []);

  return <BrandKickoffScene />;
};
