import { useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { CHAT_PROVIDER_IDS, isChatProvider } from '@goodboy/types';
import type { SessionId } from '@goodboy/types';
import { RoutingPicker } from '../../../../../shared/components/RoutingPicker';
import { useAppStore } from '../../../../../store';
import { askRoutingOf } from '../../../../../store/slices/ask/askRoutingOf';
import type { AskRouting } from '../../../../../store/slices/ask/state';
import { chatModelId, chatModelKey, shownChatEffort } from '../../../../workspace-chat/chatRouting';

type Props = {
  readonly sessionId: SessionId;
};

export const AskRoutingPicker = ({ sessionId }: Props) => {
  const connected = useAppStore(
    useShallow((state) =>
      state.providers
        .filter((candidate) => candidate.connection === 'connected' && isChatProvider(candidate.id))
        .map((candidate) => candidate.id),
    ),
  );
  const routing = useAppStore(useShallow((state) => askRoutingOf({ state, sessionId })));
  const setAskRouting = useAppStore((state) => state.setAskRouting);
  const pendingRef = useRef<AskRouting | null>(null);

  const edit = (change: (base: AskRouting) => Partial<AskRouting>): void => {
    const isFirst = pendingRef.current === null;
    const base = pendingRef.current ?? routing;
    pendingRef.current = { ...base, ...change(base) };
    if (!isFirst) {
      return;
    }
    queueMicrotask(() => {
      const next = pendingRef.current;
      pendingRef.current = null;
      if (next !== null) {
        setAskRouting({ sessionId, routing: next });
      }
    });
  };

  return (
    <RoutingPicker
      variant="pill"
      align="start"
      ariaLabel="Model for Ask"
      connectedProviders={connected.length === 0 ? CHAT_PROVIDER_IDS : connected}
      provider={routing.provider}
      model={chatModelId({ provider: routing.provider, model: routing.model })}
      effort={{
        editable: true,
        value: shownChatEffort(routing),
        onChange: (effort) => edit(() => ({ effort })),
      }}
      disabled={false}
      onProvider={(provider) => {
        if (provider !== '') {
          edit(() => ({ provider }));
        }
      }}
      onModel={(modelId) =>
        edit((base) => ({ model: chatModelKey({ provider: base.provider, modelId }) }))
      }
    />
  );
};
