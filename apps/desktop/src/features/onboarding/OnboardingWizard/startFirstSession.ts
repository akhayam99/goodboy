import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { scoutKickoffPrompt } from '../../session/components/SessionKickoff/AgentStart';
import type { FirstSessionChoice } from './steps/FirstSessionStep';

type ScoutParams = {
  readonly workspaceId: WorkspaceId;
  readonly projectId: ProjectId | null;
  readonly prompt: string;
};

export const startFirstScout = async ({ workspaceId, projectId, prompt }: ScoutParams) => {
  const state = useAppStore.getState();
  state.patchSessionDraft({ workspaceId, patch: { projectId } });
  await state.startSessionFromDraft({
    workspaceId,
    start: {
      kind: 'scout',
      agentKind: 'scout',
      focus: prompt,
      prompt: scoutKickoffPrompt({ focus: prompt }),
      routing: null,
    },
  });
};

type HandOffParams = {
  readonly workspaceId: WorkspaceId;
  readonly projectId: ProjectId | null;
  readonly choice: Exclude<FirstSessionChoice, 'agent'>;
};

export const handOffFirstSession = ({ workspaceId, projectId, choice }: HandOffParams): void => {
  const state = useAppStore.getState();
  state.patchSessionDraft({ workspaceId, patch: { choice, projectId } });
  state.openSessionDraft();
};
