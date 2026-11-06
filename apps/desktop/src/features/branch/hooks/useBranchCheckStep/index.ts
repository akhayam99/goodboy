import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { AgentId, MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { CheckChainState } from '../../../../store/slices/agents/selectCheckChain';
import { isReportedError } from '../../../../store/slices/notifications/reportedError';
import { modelLabel } from '../../../chat/utils/chat-constants';
import type { BranchCheckFacts } from '../../branchStepOf';
import { checkChainActionOf } from '../../checks/checkChainActionOf';
import { checkRoutingOf } from '../../checks/checkRoutingOf';
import { checkStepTargetOf } from '../../checks/checkStepTargetOf';
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
const LIVE_CHAINS: ReadonlySet<CheckChainState> = new Set<CheckChainState>(['analyzing', 'fixing']);

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
  const facts = useMemo<BranchCheckFacts>(
    () => ({ isFailing, chain: chain.state }),
    [chain.state, isFailing],
  );
  const liveAgentId =
    chain.state === 'fixing'
      ? (chain.fix?.id ?? null)
      : chain.state === 'analyzing'
        ? (chain.debugger?.id ?? null)
        : null;
  const work = useMemo<BranchCheckWork>(
    () => ({ chain: chain.state, agentId: liveAgentId, checkName: target.name }),
    [chain.state, liveAgentId, target.name],
  );
  const chainState = chain.state;
  const run = useCallback(async (): Promise<void> => {
    if (mountId === null || prNumber === null || LIVE_CHAINS.has(chainState)) {
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
