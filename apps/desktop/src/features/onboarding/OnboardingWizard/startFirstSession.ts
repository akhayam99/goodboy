import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { requestNewSession } from '../../session/requestNewSession';
import { writeLastStartChoice } from '../../session/components/SessionKickoff/startChoice';
import type { FirstSessionChoice } from './steps/FirstSessionStep';

type ScoutParams = {
  readonly workspaceId: WorkspaceId;
  readonly projectId: ProjectId | null;
  readonly prompt: string;
};

export const startFirstScout = async ({ workspaceId, projectId, prompt }: ScoutParams) => {
  await useAppStore.getState().createSession({
    workspaceId,
    ...(projectId === null ? {} : { projectId }),
    goal: prompt,
    firstAgentKind: 'scout',
  });
};

type HandOffParams = {
  readonly workspaceId: WorkspaceId;
  readonly choice: Exclude<FirstSessionChoice, 'agent'>;
};

export const handOffFirstSession = ({ workspaceId, choice }: HandOffParams): void => {
  writeLastStartChoice({ workspaceId, choice });
  requestNewSession();
};
