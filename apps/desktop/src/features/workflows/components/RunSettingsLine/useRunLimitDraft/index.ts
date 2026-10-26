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

type SubmitParams = {
  readonly event: FormEvent<HTMLFormElement>;
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
  const isBusyRef = useRef(false);
  const queued = useRef<Draft | null>(null);
  const saved = draftOf({ run });
  const isInvalid = draft.amount.trim() !== '' && parseSpendLimit(draft.amount) == null;
  const isDirty = draft.amount.trim() !== saved.amount || draft.mode !== saved.mode;

  const commit = async ({ draft: next, isClosing }: CommitParams): Promise<void> => {
    const limit = next.amount.trim() === '' ? null : parseSpendLimit(next.amount);
    if (next.amount.trim() !== '' && limit == null) {
      return;
    }
    if (isBusyRef.current) {
      if (isClosing) {
        queued.current = next;
      }
      return;
    }
    isBusyRef.current = true;
    setIsBusy(true);
    setFailure(null);
    try {
      await setWorkflowRunSpendLimit(sessionId, run.id, limit, next.mode);
    } catch (error) {
      if (isClosing) {
        await reportError({ title: "Couldn't change the run limit", error, sessionId });
      }
      if (!isClosing) {
        setFailure(`Couldn't change it. ${formatError(error)}`);
      }
    } finally {
      isBusyRef.current = false;
      setIsBusy(false);
    }
    const waiting = queued.current;
    queued.current = null;
    if (waiting !== null) {
      await commit({ draft: waiting, isClosing: true });
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
    submit: ({ event }: SubmitParams) => {
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
