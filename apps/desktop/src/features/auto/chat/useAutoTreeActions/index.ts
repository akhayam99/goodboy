import { useCallback, useState } from 'react';
import { brandId, type AgentId, type ArtifactId, type SessionId } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../../store';
import type { AutoTreeView } from '../../../../store/slices/auto-view/state';
import { formatError } from '@goodboy/ui';
import { currentSendNowPort } from '../../sendNowPort';
import { currentTreeRetryPort } from '../../treeRetryPort';
import { currentTreeStopPort } from '../../treeStopPort';
import { focusAgentComposer } from '../focusAgentComposer';
import type { RailRow } from '../railRowsOf';

type Params = {
  readonly sessionId: SessionId;
};

type ViewParams = {
  readonly view: AutoTreeView;
};

type SendNowParams = {
  readonly view: AutoTreeView;
  readonly rowId: string;
};

type AutoTreeActionFailure = Readonly<{
  title: string;
  message: string;
}>;

export type AutoTreeActions = Readonly<{
  isStopping: boolean;
  failure: AutoTreeActionFailure | null;
  stop: (params: ViewParams) => Promise<void>;
  retry: (params: ViewParams) => Promise<void>;
  sendNow: (params: SendNowParams) => Promise<void>;
  changeApproach: (params: ViewParams) => Promise<void>;
  openAgent: (agentId: AgentId) => void;
  openChild: (agentId: AgentId) => void;
  openRow: (row: Pick<RailRow, 'kind' | 'agentId'>) => void;
  openArtifact: (artifactId: string) => void;
}>;

export const useAutoTreeActions = ({ sessionId }: Params): AutoTreeActions => {
  const navigate = useAppStore((state) => state.navigate);
  const openDrawer = useAppStore((state) => state.openDrawer);
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  const [isStopping, setIsStopping] = useState(false);
  const [failure, setFailure] = useState<AutoTreeActionFailure | null>(null);

  const stop = useCallback(async ({ view }: ViewParams): Promise<void> => {
    setIsStopping(true);
    setFailure(null);
    try {
      const port = currentTreeStopPort();
      if (port === null) {
        throw new Error('Auto is not running yet. Stop it again in a moment.');
      }
      const result = await port({ treeId: view.tree.id });
      if (result === 'stuck') {
        throw new Error('Some agents are still running. Press Stop again to retry.');
      }
      if (result === 'not_owner') {
        throw new Error('Another window runs this conversation. Stop it there.');
      }
    } catch (error) {
      setFailure({ title: "Couldn't stop the Auto agents", message: formatError(error) });
    } finally {
      setIsStopping(false);
    }
  }, []);

  const retry = useCallback(async ({ view }: ViewParams): Promise<void> => {
    setFailure(null);
    try {
      const port = currentTreeRetryPort();
      if (port === null) {
        throw new Error('Auto is not running yet. Retry again in a moment.');
      }
      const result = await port({ treeId: view.tree.id });
      if (result.kind === 'refused') {
        throw new Error(result.message);
      }
    } catch (error) {
      setFailure({ title: "Couldn't retry Auto", message: formatError(error) });
    }
  }, []);

  const sendNow = useCallback(async ({ view, rowId }: SendNowParams): Promise<void> => {
    setFailure(null);
    try {
      const port = currentSendNowPort();
      if (port === null) {
        throw new Error("Auto isn't running yet. Send it again in a moment.");
      }
      const result = await port({ treeId: view.tree.id, rowId });
      if (result.kind === 'refused') {
        throw new Error(result.message);
      }
    } catch (error) {
      setFailure({ title: "Couldn't send the message now", message: formatError(error) });
    }
  }, []);

  const changeApproach = useCallback(
    async ({ view }: ViewParams): Promise<void> => {
      await stop({ view });
      focusAgentComposer();
    },
    [stop],
  );

  const openAgent = useCallback(
    (agentId: AgentId) => {
      closeDrawer();
      navigate({ to: agentPlace({ sessionId, agentId }) });
    },
    [closeDrawer, navigate, sessionId],
  );

  const openChild = useCallback(
    (agentId: AgentId) => openDrawer({ kind: 'spawned', sessionId, payload: { agentId } }),
    [openDrawer, sessionId],
  );

  const openRow = useCallback(
    (row: Pick<RailRow, 'kind' | 'agentId'>) => {
      if (row.kind === 'child') {
        openChild(row.agentId);
        return;
      }
      openAgent(row.agentId);
    },
    [openAgent, openChild],
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

  return {
    isStopping,
    failure,
    stop,
    retry,
    sendNow,
    changeApproach,
    openAgent,
    openChild,
    openRow,
    openArtifact,
  };
};
