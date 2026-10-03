import { useShallow } from 'zustand/react/shallow';
import { clampEffortForModel } from '@goodboy/core';
import type { ProviderId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { AgentKindRouting } from '../../../../session/agent-kind';
import { useKindRouting } from '../../../../../shared/hooks/useKindRouting';
import { draftRoutingOf } from '../../../draftRouting';

export type DraftRouting = {
  readonly routing: AgentKindRouting;
  readonly suggested: AgentKindRouting;
  readonly isOverridden: boolean;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly save: (next: AgentKindRouting | null) => void;
  readonly setEffort: (effort: AgentKindRouting['effort']) => void;
  readonly setProvider: (provider: ProviderId | '') => void;
  readonly setModel: (model: string) => void;
};

export const useDraftRouting = ({ sessionId }: { readonly sessionId: SessionId }): DraftRouting => {
  const routing = useAppStore(useShallow((s) => draftRoutingOf({ state: s, sessionId })));
  const suggested = useKindRouting({ sessionId, kind: 'resolver' });
  const isOverridden = useAppStore((s) => s.resolveQueueView[sessionId]?.lastRouting != null);
  const connectedProviders = useAppStore(
    useShallow((s) =>
      s.providers.filter((provider) => provider.connection === 'connected').map(({ id }) => id),
    ),
  );
  const setResolveQueueView = useAppStore((s) => s.setResolveQueueView);

  const save = (next: AgentKindRouting | null): void =>
    setResolveQueueView({ sessionId, patch: { lastRouting: next } });

  return {
    routing,
    suggested,
    isOverridden,
    connectedProviders,
    save,
    setEffort: (effort) => save({ ...routing, effort }),
    setProvider: (provider) => (provider === '' ? save(null) : save({ ...routing, provider })),
    setModel: (model) =>
      save({
        ...routing,
        model,
        effort:
          clampEffortForModel({ model, effort: routing.effort, provider: routing.provider }) ??
          routing.effort,
      }),
  };
};
