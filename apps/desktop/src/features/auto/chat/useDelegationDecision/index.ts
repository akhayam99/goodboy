import { CHECK_STATE } from '../../../../store/slices/notifications/errorRecovery';
import { useCallback } from 'react';
import { useAppStore } from '../../../../store';
import { CONFIRM_REFUSED_REASON } from '../../CONFIRM_REFUSED_REASON';
import {
  currentDelegationDecisionPort,
  type DelegationDecision,
  type DelegationDecisionPort,
} from '../../delegationDecisionPort';
import { useBusyAct } from '../../hooks/useBusyAct';

const NOT_READY_TITLE = "Couldn't answer Auto";
const LOST_TITLE = 'Auto has already moved on';
const REFUSED_TITLE = "This agent can't start yet";

type DecideParams = {
  readonly delegationId: string;
  readonly decision: DelegationDecision;
};

export type DelegationDecisionModel = Readonly<{
  busyId: string | null;
  decide: (params: DecideParams) => Promise<void>;
}>;

export const useDelegationDecision = (): DelegationDecisionModel => {
  const reportError = useAppStore((state) => state.reportError);
  const { busyIds, run } = useBusyAct<DelegationDecisionPort>({
    title: NOT_READY_TITLE,
    notReadyMessage: "Auto can't take this answer here yet.",
    currentPort: currentDelegationDecisionPort,
  });

  const decide = useCallback(
    ({ delegationId, decision }: DecideParams): Promise<void> =>
      run({
        busyIds: [delegationId],
        work: async ({ port }) => {
          const result = await port({ delegationId, decision });
          if (result === 'lost') {
            await reportError({
              recovery: CHECK_STATE,
              title: LOST_TITLE,
              error: new Error('This question is no longer open.'),
            });
          }
          if (result === 'refused') {
            await reportError({
              recovery: CHECK_STATE,
              title: REFUSED_TITLE,
              error: new Error(CONFIRM_REFUSED_REASON),
            });
          }
        },
      }),
    [reportError, run],
  );

  return { busyId: busyIds[0] ?? null, decide };
};
