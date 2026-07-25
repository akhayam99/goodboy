import type { RoleModelPreferences, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { roleModelsForSession } from '../../../store/slices/overrides/roleModelsForSession';

type Params = {
  readonly sessionId: SessionId | null;
};

export const useSessionRoleModels = ({ sessionId }: Params): RoleModelPreferences | null =>
  useAppStore((state) => roleModelsForSession({ state, sessionId }));
