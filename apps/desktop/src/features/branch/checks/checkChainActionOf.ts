import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import type { CheckChainState } from '../../../store/slices/agents/selectCheckChain';
import type { AgentKindRouting } from '../../session/agent-kind';
import { checkFixTargetOf } from '../../suggestions/checkFixTargetOf';
import { analyzeFailingChecks } from './analyzeFailingChecks';
import { failingChecksOf } from './failingChecksOf';
import { pushCheckFix } from './pushCheckFix';
import { startCheckFix } from './startCheckFix';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly prNumber: number;
  readonly chain: CheckChainState;
};

type RunParams = {
  readonly routing?: AgentKindRouting;
};

export type CheckChainAction = {
  readonly kind: 'analyze' | 'startFix' | 'push';
  readonly isAgain: boolean;
  readonly failureTitle: string;
  readonly run: (params: RunParams) => Promise<void>;
};

export const checkChainActionOf = ({
  sessionId,
  mountId,
  prNumber,
  chain,
}: Params): CheckChainAction => {
  if (chain === 'proposal') {
    return {
      kind: 'startFix',
      isAgain: false,
      failureTitle: "Couldn't start the Implementer",
      run: async () => {
        const target = checkFixTargetOf({ state: useAppStore.getState(), sessionId, mountId });
        if (target === null) {
          throw new Error('Refresh the failing checks and try Start fix again.');
        }
        await startCheckFix({ sessionId, url: target.url, mountId });
      },
    };
  }
  if (chain === 'fixed-local') {
    return {
      kind: 'push',
      isAgain: false,
      failureTitle: "Couldn't push the branch",
      run: async () => {
        const target = checkFixTargetOf({ state: useAppStore.getState(), sessionId, mountId });
        await pushCheckFix({ sessionId, mountId, fixAgentId: target?.fixAgentId });
      },
    };
  }
  return {
    kind: 'analyze',
    isAgain: chain === 'fixed-pushed' || chain === 'fix-failed',
    failureTitle: "Couldn't start the Debugger",
    run: async ({ routing }) => {
      const state = useAppStore.getState();
      const github = state.mountGithub[mountId];
      if (
        github?.pr?.number === prNumber &&
        (github.detail === null || github.detail.prNumber !== prNumber)
      ) {
        await state.refreshSessionPrDetail(sessionId, { mountId, force: true });
      }
      const failing = failingChecksOf({
        state: useAppStore.getState(),
        sessionId,
        mountId,
        prNumber,
      });
      if (failing === null) {
        throw new Error('Refresh the failing checks and try Analyze again.');
      }
      await analyzeFailingChecks({
        sessionId,
        mountId,
        pullRequest: failing.pullRequest,
        checks: failing.checks,
        ...(routing !== undefined && { routing }),
      });
    },
  };
};
