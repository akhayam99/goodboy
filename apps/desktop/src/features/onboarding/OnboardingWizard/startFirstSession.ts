import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { scoutKickoffPrompt } from '../../session/components/SessionKickoff/ScoutStart';
import type { FirstSessionChoice } from './steps/FirstSessionStep';

type ScoutParams = {
  readonly workspaceId: WorkspaceId;
  readonly prompt: string;
};

export const startFirstScout = async ({ workspaceId, prompt }: ScoutParams) => {
  await useAppStore.getState().startSessionFromDraft({
    workspaceId,
    start: { kind: 'scout', focus: prompt, prompt: scoutKickoffPrompt({ focus: prompt }) },
  });
};

type HandOffParams = {
  readonly workspaceId: WorkspaceId;
  readonly choice: Exclude<FirstSessionChoice, 'agent'>;
};

export const handOffFirstSession = ({ workspaceId, choice }: HandOffParams): void => {
  const state = useAppStore.getState();
  state.patchSessionDraft({ workspaceId, patch: { choice } });
  state.openSessionDraft();
};
