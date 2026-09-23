import type { RoleModelPreferences, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { selectResolvedSettings } from '../../../store/slices/overrides/selectResolvedSettings';

type Params = {
  readonly sessionId: SessionId | null;
};

export const useSessionRoleModels = ({ sessionId }: Params): RoleModelPreferences | null =>
  useAppStore((state) => selectResolvedSettings({ state, sessionId })?.roleModels ?? null);
