import { CHAT_PROVIDER_IDS, type ProviderId, type WorkspaceId } from '@goodboy/types';
import { RoutingPicker } from '../../../../../shared/components/RoutingPicker';
import { savedRouteEffort } from '../../../../../shared/components/RoutingPicker/savedRouteEffort';
import { useChatDefaultModel } from '../../../../../shared/hooks/useChatDefaultModel';
import { chatModelId, chatModelKey, shownChatEffort } from '../../../../workspace-chat/chatRouting';
import { defaultChatRouting } from '../../../../workspace-chat/defaultChatRouting';
import { useHiddenModels } from '../../../hooks/useHiddenModels';
import { DefaultRow } from './DefaultRow';
import { useAppStore } from '../../../../../store';
import { selectWorkspaceResolvedSettings } from '../../../../../store/slices/overrides/selectResolvedSettings';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly connectedProviderIds: ReadonlyArray<ProviderId>;
  readonly disabled: boolean;
};

export const ChatModelRow = ({ workspaceId, connectedProviderIds, disabled }: Props) => {
  const { saved, save, clear } = useChatDefaultModel({ workspaceId });
  const workspaceDefaultProvider = useAppStore(
    (state) => selectWorkspaceResolvedSettings({ state, workspaceId }).defaultProviderOverride,
  );
  const hidden = useHiddenModels();
  const automatic = defaultChatRouting({
    connected: connectedProviderIds,
    saved: null,
    workspaceDefaultProvider,
    hidden,
  });
  const provider = saved?.provider ?? automatic.provider;
  const shownEffort = shownChatEffort(saved ?? automatic);
  const offeredProviders = CHAT_PROVIDER_IDS.filter((candidate) =>
    connectedProviderIds.includes(candidate),
  );

  return (
    <DefaultRow label="New chats" summary="The model a new chat starts with.">
      <RoutingPicker
        availability="setup"
        ariaLabel="New chats routing"
        connectedProviders={offeredProviders}
        provider={provider}
        model={saved === null ? '' : chatModelId({ provider: saved.provider, model: saved.model })}
        effort={{ editable: true, value: shownEffort }}
        recommendation={{
          provider: automatic.provider,
          model: chatModelId({ provider: automatic.provider, model: automatic.model }),
          effort: shownChatEffort(automatic),
        }}
        recommendationKind="auto"
        autoTrigger="resolved"
        overridden={saved !== null}
        onReset={clear}
        resetLabel="Back to Auto"
        align="end"
        disabled={disabled}
        onChange={(route) => {
          if (route.provider === '') {
            clear();
            return;
          }
          save({
            routing: {
              provider: route.provider,
              model: chatModelKey({ provider: route.provider, modelId: route.model }),
              effort: savedRouteEffort({
                route,
                requested: shownEffort,
                wasSaved: saved?.effort != null,
              }),
            },
          });
        }}
      />
    </DefaultRow>
  );
};
