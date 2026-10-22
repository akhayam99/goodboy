import { useEffect, useState } from 'react';
import type { StepId, Workflow, WorkflowId } from '@goodboy/types';
import { SessionDraftPane } from '../../../../../features/session/components/SessionDraftPane';
import { brandedId } from '../../../../../features/history/testing/brandedId';
import { draftFromWorkflow } from '../../../../../features/workflows/engine';
import { useAppStore } from '../../../../../store';
import { EMPTY_SESSION_DRAFT } from '../../../../../store/slices/sessionDraft/state';
import type { StartChoice } from '../../../../../store/slices/sessionDraft/state';
import { kickoffDraftKey } from '../../../../../store/slices/workflowDrafts/kickoffDraftKey';
import { durationHistory } from '../activityRunSeed';
import { sceneClock } from '../../sceneClock';
import { mockSceneIpc } from '../mockSceneIpc';
import { WORKSPACE_ID, seedBoardScene } from '../BoardScene';
import { StudioFrame } from '../StudioFrame';
import { seedStudioChrome } from '../shellChrome';

const clock = sceneClock({ anchor: '2026-10-14T09:00:00.000Z' });

const PRESET_ID = brandedId<WorkflowId>({ value: 'mock-new-session-preset' });

const PRESET: Workflow = {
  id: PRESET_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Scout, plan, build',
  description: 'Read the code, plan the change, then build it.',
  steps: [
    {
      id: brandedId<StepId>({ value: 'mock-new-session-step-scout' }),
      workflowId: PRESET_ID,
      ordinal: 0,
      name: 'Scout the retry path',
      role: 'scout',
      effort: 'medium',
      promptPrefix: '',
      verbosity: 'normal',
    },
    {
      id: brandedId<StepId>({ value: 'mock-new-session-step-planner' }),
      workflowId: PRESET_ID,
      ordinal: 1,
      name: 'Plan the guard',
      role: 'planner',
      effort: 'high',
      promptPrefix: '',
      verbosity: 'normal',
    },
    {
      id: brandedId<StepId>({ value: 'mock-new-session-step-implementer' }),
      workflowId: PRESET_ID,
      ordinal: 2,
      name: 'Build the guard',
      role: 'implementer',
      effort: 'medium',
      promptPrefix: '',
      verbosity: 'normal',
    },
  ],
  isPreset: true,
  origin: 'custom',
  createdAt: clock.iso({ at: '2026-10-10T09:00:00.000Z' }),
  updatedAt: clock.iso({ at: '2026-10-10T09:00:00.000Z' }),
};

type SceneState = {
  readonly choice: StartChoice;
  readonly isAuto?: boolean;
  readonly isPreset?: boolean;
  readonly goal: string;
};

type Props = {
  readonly state: SceneState;
};

export const NewSessionPageScene = ({ state }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    mockSceneIpc(() => undefined);
    seedBoardScene();
    seedStudioChrome();
    const mode = state.isPreset === true ? 'preset' : 'dynamic';
    const choice = state.choice === 'workflow' && mode === 'dynamic' ? 'orchestrate' : state.choice;
    useAppStore.setState({
      phaseTemplates: { [WORKSPACE_ID]: [PRESET] },
      loadPhaseTemplates: async () => undefined,
      workspaceDurationHistory: { [WORKSPACE_ID]: durationHistory({ nowMs: Date.now() }) },
      sessionDrafts: {
        [WORKSPACE_ID]: {
          ...EMPTY_SESSION_DRAFT,
          choice,
          ...(state.choice === 'workflow' && { workflowGoal: state.goal }),
          ...(state.choice === 'orchestrate' && { workflowGoal: state.goal }),
          ...(state.choice === 'scout' && state.isAuto === true && { autoGoal: state.goal }),
          ...(state.choice === 'scout' && state.isAuto !== true && { agentPrompt: state.goal }),
        },
      },
      openSessionDraftWorkspaceId: WORKSPACE_ID,
      currentSessionId: null,
    });
    if (state.choice === 'workflow' && state.isPreset === true) {
      useAppStore.getState().setWorkflowDraft(kickoffDraftKey({ workspaceId: WORKSPACE_ID }), {
        mode,
        goalText: state.goal,
        goalHistory: [],
        selectedPresetId: PRESET_ID,
        basePresetId: PRESET_ID,
        steps: draftFromWorkflow({ workflow: PRESET }).steps,
        autoRun: true,
        autonomy: 'plan',
        title: '',
        orchestratorModel: { providerOverride: '', modelOverride: '', effortOverride: null },
        providerPool: null,
      });
    }
    setIsReady(true);
  }, [state]);

  if (!isReady) {
    return null;
  }
  return (
    <StudioFrame
      target={{ place: null, tool: null }}
      main={<SessionDraftPane workspaceId={WORKSPACE_ID} />}
    />
  );
};
