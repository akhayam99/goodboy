import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { IntegrationBinding, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { IntegrationGlyphProvider } from '../../components/IntegrationGlyph';
import { useGithubConnection } from '../../github/useGithubConnection';

type Params = {
  readonly workspaceId: WorkspaceId | null;
};

const NO_INTEGRATIONS: ReadonlyArray<IntegrationBinding> = [];

type BoundParams = {
  readonly integrations: ReadonlyArray<IntegrationBinding>;
  readonly provider: IntegrationGlyphProvider;
};

const isBound = ({ integrations, provider }: BoundParams): boolean =>
  integrations.some((binding) => binding.provider === provider);

export const useConnectedIntegrations = ({
  workspaceId,
}: Params): Readonly<Record<IntegrationGlyphProvider, boolean>> => {
  const github = useGithubConnection({ workspaceId }).isAuthenticated;
  const bound = useAppStore(
    useShallow((state) => {
      const integrations =
        workspaceId === null
          ? NO_INTEGRATIONS
          : (state.workspaceIntegrations[workspaceId] ?? NO_INTEGRATIONS);
      return {
        gitlab: isBound({ integrations, provider: 'gitlab' }),
        bitbucket: isBound({ integrations, provider: 'bitbucket' }),
        linear: isBound({ integrations, provider: 'linear' }),
        jira: isBound({ integrations, provider: 'jira' }),
        sentry: isBound({ integrations, provider: 'sentry' }),
        slack: isBound({ integrations, provider: 'slack' }),
      };
    }),
  );
  return useMemo(() => ({ ...bound, github }), [bound, github]);
};
