import { useEffect, useRef, useState, type FormEvent } from 'react';
import { formatError } from '@goodboy/ui';
import type { SessionId, WorkflowRun, WorkflowSpendLimitMode } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { parseSpendLimit } from '../../../../budget/parseSpendLimit';

type Params = {
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
  readonly isOpen: boolean;
};

type Draft = Readonly<{
  amount: string;
  mode: WorkflowSpendLimitMode;
}>;

type CommitParams = {
  readonly draft: Draft;
  readonly isClosing: boolean;
};

type DraftParams = {
  readonly run: WorkflowRun;
};

type AmountParams = {
  readonly amount: string;
};

type ModeParams = {
  readonly mode: WorkflowSpendLimitMode;
};

const draftOf = ({ run }: DraftParams): Draft => ({
  amount: run.spendLimitUsd == null ? '' : String(run.spendLimitUsd),
  mode: run.spendLimitMode ?? 'pause',
});

const INVALID = 'Enter an amount over zero, or clear the field for no limit.';

export const useRunLimitDraft = ({ sessionId, run, isOpen }: Params) => {
  const setWorkflowRunSpendLimit = useAppStore((state) => state.setWorkflowRunSpendLimit);
  const reportError = useAppStore((state) => state.reportError);
  const [draft, setDraft] = useState<Draft>(() => draftOf({ run }));
  const [failure, setFailure] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const wasOpen = useRef(false);
  const saved = draftOf({ run });
  const isInvalid = draft.amount.trim() !== '' && parseSpendLimit(draft.amount) == null;
  const isDirty = draft.amount.trim() !== saved.amount || draft.mode !== saved.mode;

  const commit = async ({ draft: next, isClosing }: CommitParams): Promise<void> => {
    const limit = next.amount.trim() === '' ? null : parseSpendLimit(next.amount);
    if (isBusy || (next.amount.trim() !== '' && limit == null)) {
      return;
    }
    setIsBusy(true);
    setFailure(null);
    try {
      await setWorkflowRunSpendLimit(sessionId, run.id, limit, next.mode);
    } catch (error) {
      if (isClosing) {
        await reportError({ title: "Couldn't change the run limit", error, sessionId });
        return;
      }
      setFailure(`Couldn't change it. ${formatError(error)}`);
    } finally {
      setIsBusy(false);
    }
  };

  const latest = useRef({ run, draft, isDirty, isInvalid, commit });
  latest.current = { run, draft, isDirty, isInvalid, commit };

  useEffect(() => {
    const now = latest.current;
    const wasShown = wasOpen.current;
    wasOpen.current = isOpen;
    if (isOpen) {
      setDraft(draftOf({ run: now.run }));
      setFailure(null);
      return;
    }
    if (wasShown && now.isDirty && !now.isInvalid) {
      void now.commit({ draft: now.draft, isClosing: true });
    }
  }, [isOpen]);

  return {
    draft,
    isBusy,
    isInvalid,
    error: isInvalid ? INVALID : failure,
    setAmount: ({ amount }: AmountParams) => setDraft((current) => ({ ...current, amount })),
    setMode: ({ mode }: ModeParams) => setDraft((current) => ({ ...current, mode })),
    submit: (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isDirty && !isInvalid) {
        void commit({ draft, isClosing: false });
      }
    },
    remove: () => {
      setDraft((current) => ({ ...current, amount: '' }));
      void commit({ draft: { ...draft, amount: '' }, isClosing: false });
    },
  };
};
