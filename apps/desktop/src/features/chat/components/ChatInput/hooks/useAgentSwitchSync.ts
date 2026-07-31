import { useEffect, useRef, type RefObject } from 'react';
import type { AgentId, ProviderId, Session } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { VerbosityLevel } from '../../../../../features/settings/verbosity';
import type { EffortLevel } from '../../../utils/chat-constants';
import { asEffortLevel, asProvider } from '../lib';

type UseAgentSwitchSyncArgs = {
  readonly session: Session;
  readonly selectedAgentId: AgentId | null;
  readonly currentProviderRef: RefObject<ProviderId | null>;
  readonly currentModelRef: RefObject<string | null>;
  readonly currentEffortRef: RefObject<EffortLevel>;
  readonly setIsPicked: (v: boolean) => void;
  readonly setSelectedProviderState: (v: ProviderId | null) => void;
  readonly setSelectedModelState: (v: string | null) => void;
  readonly setEffortState: (v: EffortLevel) => void;
  readonly setVerbosityState: (v: VerbosityLevel) => void;
  readonly setRightSizePending: (v: null) => void;
  readonly setRightSizeDismissed: (v: boolean) => void;
  readonly setScopePending: (v: null) => void;
  readonly setScopeNudgeEventId: (v: null) => void;
};

export function useAgentSwitchSync({
  session,
  selectedAgentId,
  currentProviderRef,
  currentModelRef,
  currentEffortRef,
  setIsPicked,
  setSelectedProviderState,
  setSelectedModelState,
  setEffortState,
  setVerbosityState,
  setRightSizePending,
  setRightSizeDismissed,
  setScopePending,
  setScopeNudgeEventId,
}: UseAgentSwitchSyncArgs) {
  const storeSetAgentConfig = useAppStore((s) => s.setAgentConfig);
  const workspaceDefaultVerbosity = useAppStore(
    (s) => s.workspaceOverrides[session.workspaceId]?.defaultVerbosity ?? null,
  );
  const lastAgentIdRef = useRef(selectedAgentId);

  useEffect(() => {
    if (lastAgentIdRef.current === selectedAgentId) {
      return;
    }
    const outgoingAgentId = lastAgentIdRef.current;
    lastAgentIdRef.current = selectedAgentId;

    const outgoingProvider = currentProviderRef.current;
    const outgoingModel = currentModelRef.current;
    if (outgoingAgentId !== null && (outgoingProvider !== null || outgoingModel !== null)) {
      void storeSetAgentConfig(session.id, outgoingAgentId, {
        providerOverride: outgoingProvider,
        modelOverride: outgoingModel,
        effort: currentEffortRef.current,
      });
    }

    const restoredAgent =
      selectedAgentId !== null
        ? (useAppStore.getState().sessionPhaseRuns[session.id] ?? []).find(
            (r) => r.id === selectedAgentId,
          )
        : null;
    const restoredProvider = asProvider(restoredAgent?.providerOverride);
    const restoredModel = restoredAgent?.modelOverride ?? null;
    const restoredEffort = asEffortLevel(restoredAgent?.effort);
    const restoredVerbosity =
      (restoredAgent?.verbosity as VerbosityLevel | undefined) ?? workspaceDefaultVerbosity ?? null;

    setIsPicked(false);
    setSelectedProviderState(restoredProvider);
    setSelectedModelState(restoredModel);
    if (restoredEffort !== null) {
      setEffortState(restoredEffort);
    }
    if (restoredVerbosity !== null) {
      setVerbosityState(restoredVerbosity);
    }

    setRightSizePending(null);
    setRightSizeDismissed(false);
    setScopePending(null);
    setScopeNudgeEventId(null);
  }, [selectedAgentId]); // eslint-disable-line react-hooks/exhaustive-deps
}
