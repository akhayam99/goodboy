import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { parseSpendLimit } from '../../../features/budget/parseSpendLimit';

type ApplyParams = {
  readonly usd: number | null;
};

type ReportTarget = Readonly<{ sessionId: SessionId }> | Readonly<{ workspaceId: WorkspaceId }>;

type Params = {
  readonly reportTo: ReportTarget;
  readonly currentUsd: number | null;
  readonly isOpen: boolean;
  readonly failureTitle: string;
  readonly apply: (params: ApplyParams) => Promise<string | null>;
};

type CommitParams = {
  readonly amount: string;
  readonly isClosing: boolean;
};

type AmountParams = {
  readonly amount: string;
};

type TextParams = {
  readonly usd: number | null;
};

const INVALID = 'Enter an amount over zero, or clear the field for no limit.';

const textOf = ({ usd }: TextParams): string => (usd === null ? '' : String(usd));

export const useLimitAmountDraft = ({
  reportTo,
  currentUsd,
  isOpen,
  failureTitle,
  apply,
}: Params) => {
  const reportError = useAppStore((state) => state.reportError);
  const [amount, setAmountState] = useState(() => textOf({ usd: currentUsd }));
  const [failure, setFailure] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const wasOpen = useRef(false);
  const isInvalid = amount.trim() !== '' && parseSpendLimit(amount) === null;
  const isDirty = amount.trim() !== textOf({ usd: currentUsd });

  const commit = async ({ amount: next, isClosing }: CommitParams): Promise<void> => {
    const usd = next.trim() === '' ? null : parseSpendLimit(next);
    if (isBusy || (next.trim() !== '' && usd === null)) {
      return;
    }
    setIsBusy(true);
    setFailure(null);
    const outcome = await apply({ usd });
    setIsBusy(false);
    if (outcome === null) {
      return;
    }
    if (isClosing) {
      await reportError({ title: failureTitle, error: new Error(outcome), ...reportTo });
      return;
    }
    setFailure(outcome);
  };

  const latest = useRef({ amount, currentUsd, isDirty, isInvalid, commit });
  latest.current = { amount, currentUsd, isDirty, isInvalid, commit };

  useEffect(() => {
    const now = latest.current;
    const wasShown = wasOpen.current;
    wasOpen.current = isOpen;
    if (isOpen) {
      setAmountState(textOf({ usd: now.currentUsd }));
      setFailure(null);
      return;
    }
    if (wasShown && now.isDirty && !now.isInvalid) {
      void now.commit({ amount: now.amount, isClosing: true });
    }
  }, [isOpen]);

  return {
    amount,
    isBusy,
    isInvalid,
    error: isInvalid ? INVALID : failure,
    setAmount: ({ amount: next }: AmountParams) => setAmountState(next),
    submit: (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isDirty && !isInvalid) {
        void commit({ amount, isClosing: false });
      }
    },
  };
};
