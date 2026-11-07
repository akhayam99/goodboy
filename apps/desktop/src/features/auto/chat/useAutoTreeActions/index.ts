import { useCallback, useState } from 'react';
import { brandId, type AgentId, type ArtifactId, type SessionId } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../../store';
import type { AutoTreeView } from '../../../../store/slices/auto-view/state';
import { formatError } from '@goodboy/ui';
import { currentSendNowPort } from '../../sendNowPort';
import { currentTreeRetryPort } from '../../treeRetryPort';
import { currentTreeStopPort } from '../../treeStopPort';
import { currentWithdrawPort } from '../../withdrawPort';
import { AUTO_STARTING_SENTENCE } from '../../autoStartingSentence';

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

export type WithdrawOutcome = 'withdrawn' | 'delivered' | 'failed';

type AutoTreeId = AutoTreeView['tree']['id'];

type AutoTreeActionFailure = Readonly<{
  treeId: AutoTreeId;
  title: string;
  message: string;
}>;

export type AutoTreeActions = Readonly<{
  isStopping: boolean;
  stoppingTreeId: AutoTreeId | null;
  failure: AutoTreeActionFailure | null;
  stop: (params: ViewParams) => Promise<void>;
  retry: (params: ViewParams) => Promise<void>;
  sendNow: (params: SendNowParams) => Promise<void>;
  withdraw: (params: SendNowParams) => Promise<WithdrawOutcome>;
  openChild: (agentId: AgentId) => void;
  openArtifact: (artifactId: string) => void;
}>;

export const useAutoTreeActions = ({ sessionId }: Params): AutoTreeActions => {
  const navigate = useAppStore((state) => state.navigate);
  const openDrawer = useAppStore((state) => state.openDrawer);
  const loadAutoTrees = useAppStore((state) => state.loadAutoTrees);
  const [stoppingTreeId, setStoppingTreeId] = useState<AutoTreeId | null>(null);
  const [failure, setFailure] = useState<AutoTreeActionFailure | null>(null);

  const stop = useCallback(async ({ view }: ViewParams): Promise<void> => {
    setStoppingTreeId(view.tree.id);
    setFailure(null);
    try {
      const port = currentTreeStopPort();
      if (port === null) {
        throw new Error(AUTO_STARTING_SENTENCE);
      }
      const result = await port({ treeId: view.tree.id });
      if (result === 'stuck') {
        throw new Error('Some agents are still running. Press Stop again to retry.');
      }
      if (result === 'not_owner') {
        throw new Error('Another window runs this conversation. Stop it there.');
      }
    } catch (error) {
      setFailure({
        treeId: view.tree.id,
        title: "Couldn't stop the Auto agents",
        message: formatError(error),
      });
    } finally {
      setStoppingTreeId(null);
    }
  }, []);

  const retry = useCallback(async ({ view }: ViewParams): Promise<void> => {
    setFailure(null);
    try {
      const port = currentTreeRetryPort();
      if (port === null) {
        throw new Error(AUTO_STARTING_SENTENCE);
      }
      const result = await port({ treeId: view.tree.id });
      if (result.kind === 'refused') {
        throw new Error(result.message);
      }
    } catch (error) {
      setFailure({
        treeId: view.tree.id,
        title: "Couldn't retry Auto",
        message: formatError(error),
      });
    }
  }, []);

  const sendNow = useCallback(async ({ view, rowId }: SendNowParams): Promise<void> => {
    setFailure(null);
    try {
      const port = currentSendNowPort();
      if (port === null) {
        throw new Error(AUTO_STARTING_SENTENCE);
      }
      const result = await port({ treeId: view.tree.id, rowId });
      if (result.kind === 'refused') {
        throw new Error(result.message);
      }
    } catch (error) {
      setFailure({
        treeId: view.tree.id,
        title: "Couldn't send the message now",
        message: formatError(error),
      });
    }
  }, []);

  const withdraw = useCallback(
    async ({ view, rowId }: SendNowParams): Promise<WithdrawOutcome> => {
      setFailure(null);
      try {
        const port = currentWithdrawPort();
        if (port === null) {
          throw new Error(AUTO_STARTING_SENTENCE);
        }
        const result = await port({ treeId: view.tree.id, rowId });
        if (result.kind === 'refused') {
          throw new Error(result.message);
        }
        await loadAutoTrees({ sessionId }).catch((error: unknown) => {
          setFailure({
            treeId: view.tree.id,
            title: "Couldn't refresh the queue",
            message: formatError(error),
          });
        });
        return result.kind;
      } catch (error) {
        setFailure({
          treeId: view.tree.id,
          title: "Couldn't take the message back",
          message: formatError(error),
        });
        return 'failed';
      }
    },
    [loadAutoTrees, sessionId],
  );

  const openChild = useCallback(
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

  return {
    isStopping: stoppingTreeId !== null,
    stoppingTreeId,
    failure,
    stop,
    retry,
    sendNow,
    withdraw,
    openChild,
    openArtifact,
  };
};
