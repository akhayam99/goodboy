import { useState } from 'react';
import { Button, formatError } from '@goodboy/ui';
import type { SessionBudget, SessionBudgetOnExceed, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { SpendLimitFields } from '../SpendLimitFields';
import { parseSpendLimit } from '../../parseSpendLimit';

type Props = {
  readonly sessionId: SessionId;
  readonly limit: SessionBudget | null;
  readonly onDone: () => void;
};

export const SpendLimitEditor = ({ sessionId, limit, onDone }: Props) => {
  const setSessionBudget = useAppStore((state) => state.setSessionBudget);
  const clearSessionBudget = useAppStore((state) => state.clearSessionBudget);
  const [amount, setAmount] = useState(limit === null ? '' : String(limit.softCapUsd));
  const [behavior, setBehavior] = useState<SessionBudgetOnExceed>(limit?.onExceed ?? 'pause');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isBlank = amount.trim() === '';
  const parsed = parseSpendLimit(amount);
  const isInvalid = !isBlank && parsed === null;

  const run = async (action: () => Promise<void>) => {
    setIsSaving(true);
    setError(null);
    try {
      await action();
      onDone();
    } catch (cause) {
      setError(formatError(cause));
    } finally {
      setIsSaving(false);
    }
  };

  const save = () => {
    if (isInvalid) {
      return;
    }
    if (parsed === null) {
      void run(() => clearSessionBudget(sessionId));
      return;
    }
    void run(() => setSessionBudget(sessionId, parsed, behavior));
  };

  return (
    <div className="flex flex-col gap-2">
      <SpendLimitFields
        amount={amount}
        behavior={behavior}
        inputId={`session-spend-limit-${sessionId}`}
        invalid={isInvalid}
        onAmount={setAmount}
        onBehavior={setBehavior}
      />
      {error !== null ? (
        <p role="alert" className="text-secondary text-danger">
          {error}
        </p>
      ) : (
        <p className="text-secondary text-muted-foreground">
          {isInvalid
            ? 'Enter an amount above zero, or clear it for no limit.'
            : 'Counts everything this session spends, context updates included.'}
        </p>
      )}
      <div className="flex items-center justify-end gap-1.5">
        {limit !== null ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={isSaving}
            onClick={() => void run(() => clearSessionBudget(sessionId))}
          >
            Remove limit
          </Button>
        ) : null}
        <span className="flex-1" />
        <Button variant="ghost" size="sm" disabled={isSaving} onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" disabled={isSaving || isInvalid} isBusy={isSaving} onClick={save}>
          Save
        </Button>
      </div>
    </div>
  );
};
