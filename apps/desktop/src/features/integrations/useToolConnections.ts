import type { IntegrationBinding, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { connectedToolsOf } from './connectedToolsOf';
import { useGithubConnection } from './github/useGithubConnection';

type Params = {
  readonly workspaceId: WorkspaceId | null;
};

const NO_INTEGRATIONS: ReadonlyArray<IntegrationBinding> = [];

export const useToolConnections = ({ workspaceId }: Params) => {
  const integrations = useAppStore((state) =>
    workspaceId === null
      ? NO_INTEGRATIONS
      : (state.workspaceIntegrations[workspaceId] ?? NO_INTEGRATIONS),
  );
  const github = useGithubConnection({ workspaceId });
  const globalGithub = useAppStore((state) => state.githubStatus);
  const githubIdentity = github.user ?? globalGithub?.user ?? null;
  const connected = connectedToolsOf({
    integrations,
    githubStatuses: [github.status, globalGithub],
  });
  return { integrations, connected, github, githubIdentity };
};
