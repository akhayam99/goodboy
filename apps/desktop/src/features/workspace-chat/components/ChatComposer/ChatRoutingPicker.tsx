import { useShallow } from 'zustand/react/shallow';
import { Button } from '@goodboy/ui';
import { CHAT_PROVIDER_IDS, CHAT_PROVIDER_REFUSAL, isChatProvider } from '@goodboy/types';
import type { ProviderId, WorkspaceId } from '@goodboy/types';
import { RoutingPicker } from '../../../../shared/components/RoutingPicker';
import { savedRouteEffort } from '../../../../shared/components/RoutingPicker/savedRouteEffort';
import { PROVIDER_LABEL } from '../../../providers/providerLabel';
import { useAppStore } from '../../../../store';
import { useChatDefaultModel } from '../../../../shared/hooks/useChatDefaultModel';
import { chatModelId, chatModelKey, shownChatEffort, type ChatRouting } from '../../chatRouting';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly routing: ChatRouting;
  readonly onChange: (routing: ChatRouting) => void;
};

const CHAT_ROUTING_LABEL = 'Model for this chat';

const offeredProviders = (
  connected: ReadonlyArray<ProviderId>,
  current: ProviderId,
): ReadonlyArray<ProviderId> => {
  const offered = CHAT_PROVIDER_IDS.filter(
    (candidate) => candidate === current || connected.includes(candidate),
  );
  return offered.length === 0 ? CHAT_PROVIDER_IDS : offered;
};

export const ChatRoutingPicker = ({ workspaceId, routing, onChange }: Props) => {
  const connected = useAppStore(
    useShallow((state) =>
      state.providers
        .filter((candidate) => candidate.connection === 'connected')
        .map((candidate) => candidate.id),
    ),
  );
  const defaultModel = useChatDefaultModel({ workspaceId });
  const isDefault =
    defaultModel.saved !== null &&
    defaultModel.saved.provider === routing.provider &&
    defaultModel.saved.model === routing.model &&
    shownChatEffort(defaultModel.saved) === shownChatEffort(routing);
  const refused = connected.filter((candidate) => !isChatProvider(candidate));
  const refusedLabels = refused.map((candidate) => PROVIDER_LABEL[candidate]).join(', ');

  return (
    <RoutingPicker
      variant="pill"
      align="start"
      ariaLabel={CHAT_ROUTING_LABEL}
      connectedProviders={offeredProviders(connected, routing.provider)}
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
      footer={
        <div className="flex flex-col gap-1 px-3 py-2 text-meta text-muted-foreground">
          {refused.length === 0 ? null : (
            <p>
              {refusedLabels} can&apos;t chat. {CHAT_PROVIDER_REFUSAL}.
            </p>
          )}
          <p>Applies to the next message in this chat.</p>
          {isDefault ? (
            <div className="flex items-center justify-between gap-2">
              <span>Default for new chats.</span>
              <Button variant="ghost" size="sm" onClick={defaultModel.clear}>
                Back to automatic
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span>
                {defaultModel.saved === null
                  ? 'New chats start on automatic.'
                  : 'New chats use another default model.'}
              </span>
              <Button variant="ghost" size="sm" onClick={() => defaultModel.save({ routing })}>
                Make default
              </Button>
            </div>
          )}
        </div>
      }
    />
  );
};
