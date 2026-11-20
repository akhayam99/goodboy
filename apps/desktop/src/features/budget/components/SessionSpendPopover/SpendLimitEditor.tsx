import { useState } from 'react';
import { Button, Checkbox, FormActions, formatError } from '@goodboy/ui';
import type { SessionBudget, SessionBudgetOnExceed, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { NAMES } from '../../../../shared/utils/names';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';
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
  const setSessionAutoRun = useAppStore((state) => state.setSessionAutoRun);
  const wasAutoRun = useAppStore(
    (state) => sessionById(state.sessions, sessionId)?.autoRun === true,
  );
  const [isAutoRun, setIsAutoRun] = useState(wasAutoRun);
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
    void run(async () => {
      await (parsed === null
        ? clearSessionBudget(sessionId)
        : setSessionBudget(sessionId, parsed, behavior));
      if (isAutoRun !== wasAutoRun) {
        await setSessionAutoRun(sessionId, isAutoRun);
      }
    });
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
      <p className="text-meta text-muted-foreground">
        {isInvalid
          ? 'Enter an amount over zero, or clear it for no limit.'
          : 'Counts everything this session spends, context updates included.'}
      </p>
      <Checkbox
        checked={isAutoRun}
        disabled={isSaving}
        onChange={setIsAutoRun}
        label={NAMES.startStepsWithoutAsking}
      />
      <FormActions
        error={error}
        leading={
          limit === null ? null : (
            <Button
              variant="ghost"
              size="sm"
              disabled={isSaving}
              onClick={() => void run(() => clearSessionBudget(sessionId))}
            >
              Remove limit
            </Button>
          )
        }
      >
        <Button
          variant="ghost"
          size="sm"
          disabled={isSaving}
          onClick={onDone}
          className="text-muted-foreground"
        >
          Cancel
        </Button>
        <Button size="sm" disabled={isSaving || isInvalid} isBusy={isSaving} onClick={save}>
          Save
        </Button>
      </FormActions>
    </div>
  );
};
