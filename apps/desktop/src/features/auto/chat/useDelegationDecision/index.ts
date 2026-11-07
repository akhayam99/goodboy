import { useCallback } from 'react';
import { useAppStore } from '../../../../store';
import {
  currentDelegationDecisionPort,
  type DelegationDecision,
  type DelegationDecisionPort,
} from '../../delegationDecisionPort';
import { useBusyAct } from '../../hooks/useBusyAct';

const NOT_READY_TITLE = "Couldn't answer Auto";
const LOST_TITLE = 'Auto has already moved on';

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
              title: LOST_TITLE,
              error: new Error('This question is no longer open.'),
            });
          }
        },
      }),
    [reportError, run],
  );

  return { busyId: busyIds[0] ?? null, decide };
};
