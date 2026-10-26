import { useShallow } from 'zustand/react/shallow';
import { CHAT_PROVIDER_IDS, isChatProvider } from '@goodboy/types';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { askRoutingOf } from '../../../../../store/slices/ask/askRoutingOf';
import { ConversationRoutingPicker } from '../../../../conversation/ConversationRoutingPicker';

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

  return (
    <ConversationRoutingPicker
      ariaLabel="Model for Ask"
      routing={routing}
      providers={connected.length === 0 ? CHAT_PROVIDER_IDS : connected}
      onChange={(next) => setAskRouting({ sessionId, routing: next })}
    />
  );
};
