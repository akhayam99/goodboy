import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { AgentId, MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { CheckChainState } from '../../../../store/slices/agents/selectCheckChain';
import { isReportedError } from '../../../../store/slices/notifications/reportedError';
import { modelLabel } from '../../../chat/utils/chat-constants';
import type { BranchCheckFacts } from '../../branchStepOf';
import { checkChainActionOf } from '../../checks/checkChainActionOf';
import { checkOutcomeOf } from '../../checks/checkOutcomeOf';
import { checkRoutingOf } from '../../checks/checkRoutingOf';
import { checkStepTargetOf } from '../../checks/checkStepTargetOf';
import { liveCheckWorkOf } from '../../checks/liveCheckWorkOf';
import { useCheckChain } from '../useCheckChain';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly prNumber: number | null;
  readonly isFailing: boolean;
};

export type BranchCheckWork = {
  readonly chain: CheckChainState;
  readonly agentId: AgentId | null;
  readonly checkName: string | null;
};

export type BranchCheckStep = {
  readonly facts: BranchCheckFacts;
  readonly note: string | null;
  readonly work: BranchCheckWork;
  readonly run: () => Promise<void>;
};

type Target = {
  readonly url: string;
  readonly name: string | null;
};

const NO_TARGET: Target = { url: '', name: null };

export const useBranchCheckStep = ({
  sessionId,
  mountId,
  prNumber,
  isFailing,
}: Params): BranchCheckStep => {
  const target = useAppStore(
    useShallow((state): Target => {
      if (mountId === null || prNumber === null) {
        return NO_TARGET;
      }
      const { target: found } = checkStepTargetOf({ state, sessionId, mountId, prNumber });
      return found === null ? NO_TARGET : { url: found.url, name: found.name };
    }),
  );
  const { chain } = useCheckChain({ sessionId, mountId, url: target.url });
  const routing = useAppStore(
    useShallow((state) =>
      mountId === null ? null : checkRoutingOf({ state, sessionId, mountId }),
    ),
  );
  const reportError = useAppStore((state) => state.reportError);
  const note =
    routing === null
      ? null
      : `Starts a Debugger on the failing checks with ${modelLabel(routing.model, routing.provider)} at ${routing.effort} effort`;
  const live = useAppStore(
    useShallow((state) =>
      mountId === null ? null : liveCheckWorkOf({ state, sessionId, mountId }),
    ),
  );
  const isAwaitingRun = useAppStore((state) => {
    if (mountId === null || prNumber === null || chain.state !== 'fixed-pushed') {
      return false;
    }
    const { target: found, failing } = checkStepTargetOf({ state, sessionId, mountId, prNumber });
    return (
      found !== null &&
      checkOutcomeOf({
        checks: failing?.allChecks ?? [],
        name: found.name,
        analyzedUrl: found.url,
      }) === 'running'
    );
  });
  const facts = useMemo<BranchCheckFacts>(
    () => ({ isFailing, isAwaitingRun, chain: live?.chain ?? chain.state }),
    [chain.state, isAwaitingRun, isFailing, live?.chain],
  );
  const liveAgentId = live?.agentId ?? null;
  const liveChain = live?.chain ?? null;
  const liveName = live?.name ?? null;
  const work = useMemo<BranchCheckWork>(
    () => ({
      chain: liveChain ?? chain.state,
      agentId: liveAgentId,
      checkName: liveName ?? target.name,
    }),
    [chain.state, liveAgentId, liveChain, liveName, target.name],
  );
  const chainState = chain.state;
  const run = useCallback(async (): Promise<void> => {
    if (
      mountId === null ||
      prNumber === null ||
      liveCheckWorkOf({ state: useAppStore.getState(), sessionId, mountId }) !== null
    ) {
      return;
    }
    const action = checkChainActionOf({ sessionId, mountId, prNumber, chain: chainState });
    try {
      await action.run({});
    } catch (error: unknown) {
      if (!isReportedError(error)) {
        void reportError({ title: action.failureTitle, error, sessionId });
      }
    }
  }, [chainState, mountId, prNumber, reportError, sessionId]);
  return { facts, note, work, run };
};
