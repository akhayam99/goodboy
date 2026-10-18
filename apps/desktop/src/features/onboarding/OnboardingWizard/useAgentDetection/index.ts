import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../../store';
import type { AgentProviderId } from '../../../../store/slices/providers/probeAgent';
import {
  ACTIVE_CONNECT_PHASES,
  ACTIVE_LIFECYCLE_PHASES,
} from '../../../../store/slices/providers/types';
import { AGENT_ROW_IDS } from '../agentRowIds';
import { agentCheckEngine, type AgentChecks } from './agentChecks';

export type { AgentCheck, AgentChecks } from './agentChecks';

type CheckParams = {
  readonly providerId: AgentProviderId;
};

export type AgentDetection = {
  readonly checks: AgentChecks;
  readonly isChecking: boolean;
  readonly check: (params: CheckParams) => void;
  readonly checkNow: () => void;
};

export const useAgentDetection = (): AgentDetection => {
  const probeAgent = useAppStore((state) => state.probeAgent);
  const engine = agentCheckEngine({ probe: probeAgent });
  const checks = useSyncExternalStore(engine.subscribe, engine.snapshot);
  const running = useAppStore(
    useShallow((state) =>
      AGENT_ROW_IDS.map(
        (id) =>
          ACTIVE_CONNECT_PHASES.has(state.providerConnect[id].phase) ||
          ACTIVE_LIFECYCLE_PHASES.has(state.providerLifecycle[id].phase),
      ),
    ),
  );
  const wasRunning = useRef<ReadonlyArray<boolean>>(running);

  useEffect(() => {
    engine.checkIdle();
  }, [engine]);

  useEffect(() => {
    const onFocus = () => engine.checkIdle();
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        engine.checkIdle();
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [engine]);

  useEffect(() => {
    const previous = wasRunning.current;
    wasRunning.current = running;
    AGENT_ROW_IDS.forEach((providerId, index) => {
      if (previous[index] === true && running[index] === false) {
        engine.check({ providerId });
      }
    });
  }, [engine, running]);

  return {
    checks,
    isChecking: AGENT_ROW_IDS.some((id) => checks[id].isChecking),
    check: engine.check,
    checkNow: () => AGENT_ROW_IDS.forEach((providerId) => engine.check({ providerId })),
  };
};
