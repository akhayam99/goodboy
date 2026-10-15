import { useCallback, useState } from 'react';
import { useAppStore } from '../../../../store';
import {
  currentDelegationDecisionPort,
  type DelegationDecision,
} from '../../delegationDecisionPort';

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
  const [busyId, setBusyId] = useState<string | null>(null);

  const decide = useCallback(
    async ({ delegationId, decision }: DecideParams): Promise<void> => {
      const port = currentDelegationDecisionPort();
      if (port === null) {
        await reportError({
          title: NOT_READY_TITLE,
          error: new Error('Auto cannot take this answer in this window yet.'),
        });
        return;
      }
      setBusyId(delegationId);
      try {
        const result = await port({ delegationId, decision });
        if (result === 'lost') {
          await reportError({
            title: LOST_TITLE,
            error: new Error('This question is no longer open.'),
          });
        }
      } catch (error) {
        await reportError({ title: NOT_READY_TITLE, error });
      } finally {
        setBusyId(null);
      }
    },
    [reportError],
  );

  return { busyId, decide };
};
