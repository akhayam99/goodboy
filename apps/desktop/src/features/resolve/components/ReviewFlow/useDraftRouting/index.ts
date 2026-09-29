import { useShallow } from 'zustand/react/shallow';
import { clampEffortForModel } from '@goodboy/core';
import type { ProviderId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { selectResolvedSettings } from '../../../../../store/slices/overrides/selectResolvedSettings';
import { kindRouting, type AgentKindRouting } from '../../../../session/agent-kind';
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
        effort: clampEffortForModel({ model, effort: routing.effort }) ?? routing.effort,
      }),
  };
};
