import { useEffect, useRef, useState } from 'react';
import { clampEffortForModel } from '@goodboy/core';
import {
  CHAT_PROVIDER_IDS,
  type EffortLevel,
  type ProviderId,
  type WorkspaceId,
} from '@goodboy/types';
import { RoutingPicker } from '../../../../../shared/components/RoutingPicker';
import { useChatDefaultModel } from '../../../../../shared/hooks/useChatDefaultModel';
import { chatModelId, chatModelKey, shownChatEffort } from '../../../../workspace-chat/chatRouting';
import { defaultChatRouting } from '../../../../workspace-chat/defaultChatRouting';
import { chatModelOf } from '../../../../workspace-chat/defaultChatModel';
import { useHiddenModels } from '../../../hooks/useHiddenModels';
import { DefaultRow } from './DefaultRow';
import { useAppStore } from '../../../../../store';
import { selectWorkspaceResolvedSettings } from '../../../../../store/slices/overrides/selectResolvedSettings';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly connectedProviderIds: ReadonlyArray<ProviderId>;
  readonly disabled: boolean;
};

type CommitParams = {
  readonly model: string;
  readonly effort: EffortLevel | null;
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
  const preferredProvider = saved?.provider ?? automatic.provider;
  const preferredModel = saved?.model ?? chatModelOf({ provider: preferredProvider, hidden });
  const [providerId, setProviderId] = useState<ProviderId>(preferredProvider);
  const pendingProvider = useRef<ProviderId>(preferredProvider);
  const pendingModel = useRef(preferredModel);
  const offeredProviders = CHAT_PROVIDER_IDS.filter((candidate) =>
    connectedProviderIds.includes(candidate),
  );

  useEffect(() => {
    setProviderId(preferredProvider);
    pendingProvider.current = preferredProvider;
  }, [preferredProvider]);

  useEffect(() => {
    pendingModel.current = preferredModel;
  }, [preferredModel]);

  const commit = ({ model, effort }: CommitParams) => {
    save({ routing: { provider: pendingProvider.current, model, effort } });
  };

  return (
    <DefaultRow label="New chats" summary="The model a new chat starts with.">
      <RoutingPicker
        availability="setup"
        ariaLabel="New chats routing"
        connectedProviders={offeredProviders}
        provider={providerId}
        model={saved === null ? '' : chatModelId({ provider: saved.provider, model: saved.model })}
        effort={{
          editable: true,
          value: shownChatEffort(saved ?? automatic),
          onChange: (effort) => {
            const model = pendingModel.current;
            if (model === null) {
              return;
            }
            commit({ model, effort });
          },
        }}
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
        onProvider={(next) => {
          if (next === '') {
            clear();
            return;
          }
          setProviderId(next);
          pendingProvider.current = next;
          const nextModel = chatModelOf({ provider: next });
          pendingModel.current = nextModel;
          if (saved === null || nextModel === null) {
            return;
          }
          commit({
            model: nextModel,
            effort:
              saved.effort === null
                ? null
                : clampEffortForModel({
                    model: chatModelId({ provider: next, model: nextModel }),
                    effort: saved.effort,
                    provider: next,
                  }),
          });
        }}
        onModel={(modelId) => {
          if (modelId === '') {
            clear();
            return;
          }
          const model = chatModelKey({ provider: pendingProvider.current, modelId });
          pendingModel.current = model;
          commit({
            model,
            effort:
              saved?.effort == null
                ? null
                : clampEffortForModel({
                    model: modelId,
                    effort: saved.effort,
                    provider: pendingProvider.current,
                  }),
          });
        }}
      />
    </DefaultRow>
  );
};
