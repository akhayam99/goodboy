import { useShallow } from 'zustand/react/shallow';
import { CHAT_PROVIDER_IDS, isChatProvider } from '@goodboy/types';
import type { SessionId } from '@goodboy/types';
import { RoutingPicker } from '../../../../../shared/components/RoutingPicker';
import { savedRouteEffort } from '../../../../../shared/components/RoutingPicker/savedRouteEffort';
import { useAppStore } from '../../../../../store';
import { askRoutingOf } from '../../../../../store/slices/ask/askRoutingOf';
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

  return (
    <RoutingPicker
      variant="pill"
      align="start"
      ariaLabel="Model for Ask"
      connectedProviders={connected.length === 0 ? CHAT_PROVIDER_IDS : connected}
      provider={routing.provider}
      model={chatModelId({ provider: routing.provider, model: routing.model })}
      effort={{ editable: true, value: shownChatEffort(routing) }}
      disabled={false}
      onChange={(route) => {
        if (route.provider === '') {
          return;
        }
        setAskRouting({
          sessionId,
          routing: {
            provider: route.provider,
            model: chatModelKey({ provider: route.provider, modelId: route.model }),
            effort: savedRouteEffort({
              route,
              requested: shownChatEffort(routing),
              wasSaved: routing.effort !== null,
            }),
          },
        });
      }}
    />
  );
};
