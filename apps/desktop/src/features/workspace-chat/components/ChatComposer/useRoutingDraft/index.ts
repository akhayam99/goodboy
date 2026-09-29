import { useCallback, useRef } from 'react';
import type { EffortLevel, ProviderId } from '@goodboy/types';
import { chatModelKey, type ChatRouting } from '../../../chatRouting';

type Params = {
  readonly routing: ChatRouting;
  readonly onCommit: (routing: ChatRouting) => void;
};

type Edit = Partial<ChatRouting> | ((base: ChatRouting) => Partial<ChatRouting>);

export type RoutingDraft = {
  readonly setProvider: (provider: ProviderId) => void;
  readonly setModelId: (modelId: string) => void;
  readonly setEffort: (effort: EffortLevel) => void;
};

export const useRoutingDraft = ({ routing, onCommit }: Params): RoutingDraft => {
  const pendingRef = useRef<ChatRouting | null>(null);
  const latest = useRef({ routing, onCommit });
  latest.current = { routing, onCommit };

  const edit = useCallback((change: Edit) => {
    const isFirst = pendingRef.current === null;
    const base = pendingRef.current ?? latest.current.routing;
    pendingRef.current = { ...base, ...(typeof change === 'function' ? change(base) : change) };
    if (!isFirst) {
      return;
    }
    queueMicrotask(() => {
      const next = pendingRef.current;
      pendingRef.current = null;
      if (next !== null) {
        latest.current.onCommit(next);
      }
    });
  }, []);

  const setProvider = useCallback((provider: ProviderId) => edit({ provider }), [edit]);
  const setModelId = useCallback(
    (modelId: string) =>
      edit((base) => ({ model: chatModelKey({ provider: base.provider, modelId }) })),
    [edit],
  );
  const setEffort = useCallback((effort: EffortLevel) => edit({ effort }), [edit]);

  return { setProvider, setModelId, setEffort };
};
