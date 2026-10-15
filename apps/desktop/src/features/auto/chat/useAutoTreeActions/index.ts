import { useCallback, useState } from 'react';
import { brandId, type AgentId, type ArtifactId, type SessionId } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../../store';
import type { AutoTreeView } from '../../../../store/slices/auto-view/state';
import { currentTreeStopPort } from '../../treeStopPort';
import { focusAgentComposer } from '../focusAgentComposer';

type Params = {
  readonly sessionId: SessionId;
};

type ViewParams = {
  readonly view: AutoTreeView;
};

export type AutoTreeActions = Readonly<{
  isStopping: boolean;
  stop: (params: ViewParams) => Promise<void>;
  changeApproach: (params: ViewParams) => Promise<void>;
  openAgent: (agentId: AgentId) => void;
  openArtifact: (artifactId: string) => void;
}>;

export const useAutoTreeActions = ({ sessionId }: Params): AutoTreeActions => {
  const navigate = useAppStore((state) => state.navigate);
  const openDrawer = useAppStore((state) => state.openDrawer);
  const reportError = useAppStore((state) => state.reportError);
  const [isStopping, setIsStopping] = useState(false);

  const stop = useCallback(
    async ({ view }: ViewParams): Promise<void> => {
      setIsStopping(true);
      try {
        const port = currentTreeStopPort();
        if (port === null) {
          throw new Error('Auto cannot be stopped from this window.');
        }
        const result = await port({ treeId: view.tree.id });
        if (result === 'stuck') {
          throw new Error('Some agents are still running. Press Stop again to retry.');
        }
        if (result === 'not_owner') {
          throw new Error('Another window runs this conversation. Stop it there.');
        }
      } catch (error) {
        await reportError({ title: "Couldn't stop the Auto agents", error, sessionId });
      } finally {
        setIsStopping(false);
      }
    },
    [reportError, sessionId],
  );

  const changeApproach = useCallback(
    async ({ view }: ViewParams): Promise<void> => {
      await stop({ view });
      focusAgentComposer();
    },
    [stop],
  );

  const openAgent = useCallback(
    (agentId: AgentId) => navigate({ to: agentPlace({ sessionId, agentId }) }),
    [navigate, sessionId],
  );

  const openArtifact = useCallback(
    (artifactId: string) =>
      openDrawer({
        kind: 'artifact-document',
        sessionId,
        payload: { artifactId: brandId<ArtifactId>({ value: artifactId }), revision: null },
      }),
    [openDrawer, sessionId],
  );

  return { isStopping, stop, changeApproach, openAgent, openArtifact };
};
