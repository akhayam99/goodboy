import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { discardUncreatedSession } from '../../../store/slices/sessions/discardUncreatedSession';
import { draftGoalText } from '../../../store/slices/sessionStart/draftGoalText';
import { scoutKickoffPrompt } from './scoutKickoffPrompt';
import type { FirstSessionChoice } from './steps/FirstSessionStep';

export const SCOUT_FIRST_TITLE = 'Scout the project';

type ScoutParams = {
  readonly workspaceId: WorkspaceId;
  readonly projectId: ProjectId | null;
  readonly prompt: string;
};

export const startFirstScout = async ({ workspaceId, projectId, prompt }: ScoutParams) => {
  const goal = draftGoalText({ text: prompt });
  const title = goal === '' ? SCOUT_FIRST_TITLE : goal;
  const { session } = await useAppStore.getState().createSession({
    workspaceId,
    goal: goal === '' ? title : goal,
    title,
    omitGoalSlot: goal === '',
    ...(projectId !== null && { projectId }),
  });
  try {
    await useAppStore.getState().spawnAgent(session.id, {
      kindOverride: 'scout',
      initialPrompt: scoutKickoffPrompt({ focus: prompt }),
      focus: 'agent',
    });
  } catch (error) {
    await discardUncreatedSession({ set: useAppStore.setState, sessionId: session.id });
    throw error;
  }
  useAppStore.setState({ goodboyNamedSessionId: session.id });
};

type HandOffParams = {
  readonly workspaceId: WorkspaceId;
  readonly projectId: ProjectId | null;
  readonly choice: Exclude<FirstSessionChoice, 'agent'>;
};

export const handOffFirstSession = async ({
  workspaceId,
  projectId,
  choice,
}: HandOffParams): Promise<void> => {
  if (choice === 'task') {
    window.dispatchEvent(new CustomEvent('goodboy:open-inbox'));
    return;
  }
  const state = useAppStore.getState();
  const { session } = await state.createSession({
    workspaceId,
    goal: '',
    omitGoalSlot: true,
    ...(projectId !== null && { projectId }),
  });
  useAppStore.getState().focusSessionSetupStep({ sessionId: session.id, step: 'work' });
};
