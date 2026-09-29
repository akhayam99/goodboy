import { useShallow } from 'zustand/react/shallow';
import { clampEffortForModel } from '@goodboy/core';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { RoutingPickerBody } from '../../../../shared/components/RoutingPicker/RoutingPickerBody';
import { SUGGESTED_LABEL } from '../../../../shared/components/RoutingPicker/autoRecommendationCopy';
import { selectResolvedSettings } from '../../../../store/slices/overrides/selectResolvedSettings';
import { kindRouting, type AgentKindRouting } from '../../../session/agent-kind';
import { draftRoutingOf } from '../../draftFixes';

type Props = {
  readonly sessionId: SessionId;
  readonly onClose: () => void;
};

export const DraftRoutingBody = ({ sessionId, onClose }: Props) => {
  const routing = useAppStore(useShallow((s) => draftRoutingOf({ state: s, sessionId })));
  const suggested = useAppStore(
    useShallow((s) =>
      kindRouting({
        kind: 'resolver',
        roleModels: selectResolvedSettings({ state: s, sessionId })?.roleModels ?? null,
      }),
    ),
  );
  const isOverridden = useAppStore((s) => s.resolveQueueView[sessionId]?.lastRouting != null);
  const connectedProviders = useAppStore(
    useShallow((s) =>
      s.providers.filter((provider) => provider.connection === 'connected').map(({ id }) => id),
    ),
  );
  const setResolveQueueView = useAppStore((s) => s.setResolveQueueView);

  const save = (next: AgentKindRouting | null): void =>
    setResolveQueueView({ sessionId, patch: { lastRouting: next } });

  return (
    <RoutingPickerBody
      connectedProviders={connectedProviders}
      onClose={onClose}
      recommendation={{ ...suggested, label: SUGGESTED_LABEL }}
      overridden={isOverridden}
      onReset={() => save(null)}
      provider={routing.provider}
      model={routing.model}
      effort={{
        editable: true,
        value: routing.effort,
        onChange: (effort) => save({ ...routing, effort }),
      }}
      onProvider={(provider) => (provider === '' ? save(null) : save({ ...routing, provider }))}
      onModel={(model) =>
        save({
          ...routing,
          model,
          effort: clampEffortForModel({ model, effort: routing.effort }) ?? routing.effort,
        })
      }
    />
  );
};
