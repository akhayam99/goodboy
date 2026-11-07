import type {
  SessionExternalTask,
  SessionExternalTaskProvider,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import type { AppState } from '../../../../../../store/types';
import type { OpenDrawer } from '../../../../../../store/slices/drawer/state';
import { drawerKey } from '../../../../../../store/slices/drawer/drawerKey';
import { captureLocation } from '../../../../../../store/slices/navigation/captureLocation';
import { PROVIDER_LENS } from '../../../../../integrations/providerLens';

type Params = {
  readonly state: AppState;
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId;
  readonly provider: Exclude<SessionExternalTaskProvider, 'github' | 'sentry'>;
  readonly task: SessionExternalTask;
  readonly drawer: OpenDrawer | null;
};

type SameDrawerParams = {
  readonly before: OpenDrawer | null;
  readonly now: OpenDrawer | null;
};

const isSameDrawer = ({ before, now }: SameDrawerParams): boolean => {
  if (before === null || now === null) {
    return before === now;
  }
  return before.sessionId === now.sessionId && drawerKey(before) === drawerKey(now);
};

export const isTaskOnScreen = ({
  state,
  workspaceId,
  sessionId,
  provider,
  task,
  drawer,
}: Params) => {
  const live = captureLocation({ state });
  if (live.workspaceId !== workspaceId || live.studio !== null || live.place.at !== 'session') {
    return false;
  }
  if (!isSameDrawer({ before: drawer, now: live.focus.drawer })) {
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
