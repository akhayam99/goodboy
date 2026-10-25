import type { ReactNode } from 'react';
import type { ProviderId } from '@goodboy/types';
import { RoutingPicker } from '../../shared/components/RoutingPicker';
import { savedRouteEffort } from '../../shared/components/RoutingPicker/savedRouteEffort';
import { chatModelId, chatModelKey, shownChatEffort, type ChatRouting } from './chatRouting';

type Props = {
  readonly ariaLabel: string;
  readonly routing: ChatRouting;
  readonly providers: ReadonlyArray<ProviderId>;
  readonly footer?: ReactNode;
  readonly onChange: (routing: ChatRouting) => void;
};

export const ConversationRoutingPicker = ({
  ariaLabel,
  routing,
  providers,
  footer,
  onChange,
}: Props) => (
  <RoutingPicker
    variant="pill"
    align="start"
    ariaLabel={ariaLabel}
    connectedProviders={providers}
    provider={routing.provider}
    model={chatModelId({ provider: routing.provider, model: routing.model })}
    effort={{ editable: true, value: shownChatEffort(routing) }}
    disabled={false}
    onChange={(route) => {
      if (route.provider === '') {
        return;
      }
      onChange({
        provider: route.provider,
        model: chatModelKey({ provider: route.provider, modelId: route.model }),
        effort: savedRouteEffort({
          route,
          requested: shownChatEffort(routing),
          wasSaved: routing.effort !== null,
        }),
      });
    }}
    footer={footer}
  />
);
