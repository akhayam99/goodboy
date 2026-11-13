import { useCallback, useEffect } from 'react';
import type { SessionId } from '@goodboy/types';
import { useActionRun, useAppStore } from '../../../../store';
import type { BrowserTab } from '../../../../store/slices/browser/types';
import { useHandOutputToAgent } from '../../../../shared/hooks/useHandOutputToAgent';
import { NAMES } from '../../../../shared/utils/names';
import { sendPageToAgent, pageSendKeyOf } from '../../sendPageToAgent';
import type { BrowserPageSend } from '../../types';

type ResolvedTab = {
  readonly liveId: string;
  readonly url: string;
};

type TabParams = {
  readonly tab: BrowserTab;
};

type Params = {
  readonly sessionId: SessionId;
  readonly shown: BrowserTab | null;
  readonly tabs: ReadonlyArray<BrowserTab>;
  readonly resolve: (params: TabParams) => ResolvedTab | null;
};

type UrlParams = {
  readonly url: string;
};

const isWebUrl = ({ url }: UrlParams): boolean =>
  url.startsWith('http://') || url.startsWith('https://');

export const useSendPageToAgent = ({
  sessionId,
  shown,
  tabs,
  resolve,
}: Params): BrowserPageSend => {
  const target = useHandOutputToAgent({ sessionId });
  const runKey = pageSendKeyOf({ sessionId });
  const run = useActionRun({ key: runKey });
  const isBusy = run !== null && run.phase === 'pending';
  const { agentId, canHandOff, queue } = target;

  useEffect(() => {
    useAppStore.getState().attachActionRunSurface({ key: runKey });
    return () => {
      useAppStore.getState().detachActionRunSurface({ key: runKey });
    };
  }, [runKey]);

  const canSendTab = useCallback(
    ({ tab }: TabParams): boolean => {
      const resolved = resolve({ tab });
      return target.canHandOff && resolved !== null && isWebUrl({ url: resolved.url });
    },
    [resolve, target.canHandOff],
  );

  const send = useCallback(
    ({ tab }: TabParams): void => {
      const resolved = resolve({ tab });
      if (
        !canHandOff ||
        agentId === null ||
        resolved === null ||
        !isWebUrl({ url: resolved.url })
      ) {
        return;
      }
      void sendPageToAgent({
        sessionId,
        tabId: resolved.liveId,
        rowId: tab.id,
        url: resolved.url,
        agentId,
        queue,
      });
    },
    [agentId, canHandOff, queue, resolve, sessionId],
  );

  const retry = useCallback((): void => {
    const rowId = useAppStore.getState().actionRuns[runKey]?.choice;
    const tab = tabs.find((candidate) => candidate.id === rowId);
    if (tab !== undefined) {
      send({ tab });
    }
  }, [runKey, send, tabs]);

  return {
    label: target.agentName === null ? NAMES.sendToTheAgent : `Send to ${target.agentName}`,
    canSend: shown !== null && canSendTab({ tab: shown }),
    canSendTab,
    isBusy,
    runKey,
    send,
    retry,
    sendShown: () => {
      if (shown !== null) {
        send({ tab: shown });
      }
    },
  };
};
