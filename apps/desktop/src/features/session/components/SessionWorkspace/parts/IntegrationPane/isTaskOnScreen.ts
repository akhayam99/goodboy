import type {
  SessionExternalTask,
  SessionExternalTaskProvider,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import type { AppState } from '../../../../../../store/types';
import { captureLocation } from '../../../../../../store/slices/navigation/captureLocation';
import { PROVIDER_LENS } from '../../../../../integrations/providerLens';

type Params = {
  readonly state: AppState;
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId;
  readonly provider: Exclude<SessionExternalTaskProvider, 'github' | 'sentry'>;
  readonly task: SessionExternalTask;
};

export const isTaskOnScreen = ({ state, workspaceId, sessionId, provider, task }: Params) => {
  const live = captureLocation({ state });
  if (live.workspaceId !== workspaceId || live.studio !== null || live.place.at !== 'session') {
    return false;
  }
  const { place } = live;
  const target = place.view.target;
  return (
    place.sessionId === sessionId &&
    place.view.lens === PROVIDER_LENS[provider] &&
    target?.kind === 'external-task' &&
    target.task.provider === provider &&
    target.task.externalId === task.externalId &&
    (target.task.projectId ?? null) === (task.projectId ?? null)
  );
};
