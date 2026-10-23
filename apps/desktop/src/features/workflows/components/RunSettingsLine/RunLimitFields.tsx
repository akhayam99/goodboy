import { Button } from '@goodboy/ui';
import type { WorkflowRun } from '@goodboy/types';
import { SpendLimitFields } from '../../../budget/components/SpendLimitFields';
import { behaviorOfRunMode, runModeOfBehavior } from '../../../budget/spendLimitBehavior';
import type { useRunLimitDraft } from './useRunLimitDraft';

type Props = {
  readonly run: WorkflowRun;
  readonly limit: ReturnType<typeof useRunLimitDraft>;
};

export const RunLimitFields = ({ run, limit }: Props) => (
  <form aria-label="Limit for this run" onSubmit={limit.submit} className="flex flex-col gap-2">
    <SpendLimitFields
      amount={limit.draft.amount}
      behavior={behaviorOfRunMode({ mode: limit.draft.mode })}
      inputId={`run-spend-limit-${run.id}`}
      invalid={limit.isInvalid}
      onAmount={(amount) => limit.setAmount({ amount })}
      onBehavior={(behavior) => limit.setMode({ mode: runModeOfBehavior({ behavior }) })}
    />
    {run.spendLimitUsd == null ? null : (
      <Button
        size="xs"
        variant="quiet"
        disabled={limit.isBusy}
        data-testid="run-spend-limit-remove"
        onClick={limit.remove}
        className="self-start"
      >
        Remove limit
      </Button>
    )}
  </form>
);
