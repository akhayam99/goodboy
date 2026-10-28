import { useCallback, useState } from 'react';
import type { ProviderId, SessionId, WorkspaceId } from '@goodboy/types';
import type { PickedRoute } from '../../../../../shared/components/RoutingPicker/PickedRoute';
import { KIND_TO_ROLE, ROLE_LABEL } from '../../../agent-kind';
import { useRunModelDefault, type RunModelRouting } from '../../../hooks/useRunModelDefault';
import type { RunModelPin } from '../../../startRun/runModelPin';
import { RUN_MODEL_COPY } from '../../../startRun/runModelCopy';
import { runModelSlotKeyOf, type RunModelSlot } from '../../../startRun/runModelSlotOf';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId | null;
  readonly slot: RunModelSlot;
};

type PinForParams = {
  readonly slot: RunModelSlot;
};

export type RunModelView = Readonly<{
  slot: RunModelSlot;
  label: string;
  effective: RunModelRouting;
  suggestion: RunModelRouting;
  isPinned: boolean;
  connectedProviders: ReadonlyArray<ProviderId>;
  pick: (route: PickedRoute | null) => void;
}>;

export type RunModelModel = RunModelView &
  Readonly<{
    pinFor: (params: PinForParams) => RunModelPin | null;
    clear: () => void;
  }>;

const NO_PINS: Readonly<Record<string, RunModelPin>> = {};

export const useRunModel = ({ workspaceId, sessionId, slot }: Params): RunModelModel => {
  const [pins, setPins] = useState<Readonly<Record<string, RunModelPin>>>(NO_PINS);
  const { suggestion, connectedProviders } = useRunModelDefault({ workspaceId, sessionId, slot });
  const key = runModelSlotKeyOf({ slot });
  const pin = pins[key] ?? null;

  const pick = useCallback(
    (route: PickedRoute | null): void => {
      setPins((current) => {
        if (route === null || route.provider === '') {
          return Object.fromEntries(Object.entries(current).filter(([entry]) => entry !== key));
        }
        return {
          ...current,
          [key]: { provider: route.provider, model: route.model, effort: route.effort },
        };
      });
    },
    [key],
  );
  const pinFor = useCallback(
    ({ slot: wanted }: PinForParams): RunModelPin | null =>
      pins[runModelSlotKeyOf({ slot: wanted })] ?? null,
    [pins],
  );
  const clear = useCallback((): void => setPins(NO_PINS), []);

  return {
    slot,
    label:
      slot.kind === 'orchestrator'
        ? RUN_MODEL_COPY.orchestrator
        : ROLE_LABEL[KIND_TO_ROLE[slot.agentKind]],
    effective: pin ?? suggestion,
    suggestion,
    isPinned: pin !== null,
    connectedProviders,
    pick,
    pinFor,
    clear,
  };
};
