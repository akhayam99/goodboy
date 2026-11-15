import { useCallback, useEffect, useMemo, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import type { IntegrationGlyphProvider } from '../../../../shared/components/IntegrationGlyph';
import { integrationLabel } from '../../../../shared/utils/integrationLabel';
import { useAppStore } from '../../../../store';
import { selectIntegrationKeyCheck } from '../../../../store/slices/integrations/selectIntegrationKeyCheck';
import type { KeyBinding } from '../../../../store/slices/integrations/verifyReplacementKey';
import { isGithubConnected } from '../../../integrations/github/isGithubConnected';
import { useGithubConnection } from '../../../integrations/github/useGithubConnection';
import { integrationTargetOf } from '../../../integrations/integrationTargetOf';
import { toolStateOf } from '../../model/toolStateOf';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly tool: IntegrationGlyphProvider;
};

export const useToolPage = ({ workspaceId, tool }: Params) => {
  const binding = useAppStore((state) =>
    (state.workspaceIntegrations[workspaceId] ?? []).find(
      (candidate): candidate is KeyBinding =>
        candidate.provider === tool &&
        candidate.provider !== 'github' &&
        candidate.projectId === null,
    ),
  );
  const credentialId = binding?.credentialId ?? null;
  const keyCheck = useAppStore((state) => selectIntegrationKeyCheck({ state, credentialId }));
  const checkIntegrationKey = useAppStore((state) => state.checkIntegrationKey);
  const disconnectIntegration = useAppStore((state) => state.disconnectIntegration);
  const refreshGithubStatus = useAppStore((state) => state.refreshGithubStatus);
  const globalGithub = useAppStore((state) => state.githubStatus);
  const github = useGithubConnection({ workspaceId });
  const [checkError, setCheckError] = useState<string | null>(null);

  const isGithub = tool === 'github';
  const isConnected = isGithub
    ? isGithubConnected({
        isWorkspaceAuthenticated: github.isAuthenticated,
        globalStatus: globalGithub,
      })
    : binding !== undefined;
  const toolState = toolStateOf({ isConnected, hasKey: !isGithub, keyCheck });
  const refreshGithub = github.refresh;

  const check = useCallback(async (): Promise<void> => {
    if (isGithub) {
      await refreshGithubStatus();
      refreshGithub();
      return;
    }
    if (credentialId === null) {
      return;
    }
    setCheckError(null);
    try {
      await checkIntegrationKey({ credentialId });
    } catch {
      setCheckError(`Couldn't check the ${integrationLabel({ provider: tool })} key.`);
    }
  }, [isGithub, credentialId, checkIntegrationKey, refreshGithubStatus, refreshGithub, tool]);

  useEffect(() => {
    if (isGithub || credentialId === null) {
      return;
    }
    void check();
  }, [isGithub, credentialId, check]);

  const target = useMemo(
    () =>
      integrationTargetOf({
        workspaceId,
        provider: tool,
        isConnected,
        onCheck: check,
        onDisconnect: async () => {
          if (tool === 'github') {
            return;
          }
          await disconnectIntegration({ workspaceId, provider: tool });
        },
      }),
    [workspaceId, tool, isConnected, check, disconnectIntegration],
  );

  return {
    label: integrationLabel({ provider: tool }),
    binding: binding ?? null,
    isGithub,
    isConnected,
    toolState,
    keyCheck,
    checkError,
    github,
    githubStatus: globalGithub,
    githubIdentity: github.user ?? globalGithub?.user ?? null,
    target,
    check,
  };
};
