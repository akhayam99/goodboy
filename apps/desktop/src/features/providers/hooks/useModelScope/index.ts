import { useMemo } from 'react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import {
  selectModelContext,
  type ModelScope,
} from '../../../../store/slices/models/selectModelContext';

export type ScopeProps = {
  readonly sessionId?: SessionId | null;
  readonly workspaceId?: WorkspaceId | null;
};

export const useModelScope = ({ sessionId, workspaceId }: ScopeProps): ModelScope => {
  const providers = useAppStore((state) => state.providers);
  const providerLimits = useAppStore((state) => state.providerLimits);
  const settings = useAppStore((state) => state.settings);
  const cliRequirements = useAppStore((state) => state.cliRequirements);
  const workspaceOverrides = useAppStore((state) => state.workspaceOverrides);
  const sessionOverrides = useAppStore((state) => state.sessionOverrides);
  const projects = useAppStore((state) => state.projects);
  const sessions = useAppStore((state) => state.sessions);
  const sessionActiveProject = useAppStore((state) => state.sessionActiveProject);
  return useMemo(
    () =>
      selectModelContext({
        state: {
          providers,
          providerLimits,
          settings,
          cliRequirements,
          workspaceOverrides,
          sessionOverrides,
          projects,
          sessions,
          sessionActiveProject,
        },
        sessionId,
        workspaceId,
      }),
    [
      providers,
      providerLimits,
      settings,
      cliRequirements,
      workspaceOverrides,
      sessionOverrides,
      projects,
      sessions,
      sessionActiveProject,
      sessionId,
      workspaceId,
    ],
  );
};
