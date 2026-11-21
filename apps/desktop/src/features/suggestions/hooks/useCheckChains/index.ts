import { useMemo } from 'react';
import type { AgentId, AgentStatus, MountId, SessionId, SessionProjectMount } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import {
  selectCheckChain,
  type CheckChainState,
} from '../../../../store/slices/agents/selectCheckChain';
import { checkOutcomeOf, type CheckOutcome } from '../../../branch/checks/checkOutcomeOf';
import { checkStepTargetOf } from '../../../branch/checks/checkStepTargetOf';
import {
  useCheckFixCommitSync,
  type CheckFixTarget,
} from '../../../../shared/hooks/useCheckFixCommitSync';
import type { SuggestionCheckChain } from '../../deriveNextSteps';

type Params = {
  readonly sessionId: SessionId;
  readonly rebaseMounts: ReadonlyArray<SessionProjectMount>;
};

type ChainRow = {
  readonly mountId: MountId;
  readonly checkName: string;
  readonly chain: CheckChainState;
  readonly commit: string | null;
  readonly commitCount: number;
  readonly outcome: CheckOutcome | null;
  readonly fixAgentId: AgentId | null;
  readonly fixStatus: AgentStatus | null;
};

const NO_FIX_TARGETS: ReadonlyArray<CheckFixTarget> = [];

export const useCheckChains = ({
  sessionId,
  rebaseMounts,
}: Params): ReadonlyArray<SuggestionCheckChain> => {
  const chainRowsJson = useAppStore((state) =>
    JSON.stringify(
      rebaseMounts.flatMap((mount): ReadonlyArray<ChainRow> => {
        const { target, failing } = checkStepTargetOf({
          state,
          sessionId,
          mountId: mount.mountId,
          prNumber: state.mountGithub[mount.mountId]?.pr?.number ?? null,
        });
        if (target === null) {
          return [];
        }
        const chain = selectCheckChain({ state, sessionId, url: target.url });
        if (chain.state === 'none') {
          return [];
        }
        const outcome =
          chain.state === 'fixed-pushed'
            ? checkOutcomeOf({
                checks: failing?.allChecks ?? [],
                name: target.name,
                analyzedUrl: target.url,
              })
            : null;
        return [
          {
            mountId: mount.mountId,
            checkName: target.name ?? 'The check',
            chain: chain.state,
            commit: chain.commit,
            commitCount: chain.commitCount,
            outcome,
            fixAgentId: chain.fix?.id ?? null,
            fixStatus: chain.fix?.status ?? null,
          },
        ];
      }),
    ),
  );
  const chainRows = useMemo(
    (): ReadonlyArray<ChainRow> => JSON.parse(chainRowsJson),
    [chainRowsJson],
  );
  const checkChains = useMemo(
    (): ReadonlyArray<SuggestionCheckChain> =>
      chainRows.map(({ mountId, checkName, chain, commit, commitCount, outcome }) => ({
        mountId,
        checkName,
        chain,
        commit,
        commitCount,
        outcome,
      })),
    [chainRows],
  );
  const fixTargets = useMemo(
    (): ReadonlyArray<CheckFixTarget> =>
      chainRows.flatMap(({ mountId, fixAgentId, fixStatus }) =>
        fixAgentId === null || fixStatus !== 'completed' ? [] : [{ mountId, fixAgentId }],
      ),
    [chainRows],
  );
  useCheckFixCommitSync({
    sessionId,
    targets: fixTargets.length === 0 ? NO_FIX_TARGETS : fixTargets,
  });
  return checkChains;
};
