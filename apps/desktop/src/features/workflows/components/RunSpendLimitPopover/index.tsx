import { useState } from 'react';
import { CircleDollarSign } from 'lucide-react';
import {
  AnchoredPopover,
  Button,
  cn,
  FormActions,
  formatUsd,
  PopoverBody,
  useDropdown,
} from '@goodboy/ui';
import type { SessionId, WorkflowRun, WorkflowSpendLimitMode } from '@goodboy/types';
import { useAppStore } from '../../../../store/store';
import { useRunSpendUsd } from '../../../../store/slices/sessions/selectors';
import { OrchestratorAction } from '../OrchestratorStrip/OrchestratorAction';
import { SpendLimitFields } from '../../../budget/components/SpendLimitFields';
import { parseSpendLimit } from '../../../budget/parseSpendLimit';
import { behaviorOfRunMode, runModeOfBehavior } from '../../../budget/spendLimitBehavior';

type Props = {
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
  readonly variant: 'primary' | 'meta';
};

export const RunSpendLimitPopover = ({ sessionId, run, variant }: Props) => {
  const setWorkflowRunSpendLimit = useAppStore((state) => state.setWorkflowRunSpendLimit);
  const spentUsd = useRunSpendUsd(sessionId, run.id);
  const limitUsd = run.spendLimitUsd ?? null;
  const dropdown = useDropdown({
    align: 'end',
    expectedHeight: 220,
    expectedWidth: 264,
    width: 'w-64',
  });
  const { open, close, toggle } = dropdown;
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<WorkflowSpendLimitMode>('pause');
  const [busy, setBusy] = useState(false);

  const onToggle = () => {
    setAmount(limitUsd == null ? '' : String(limitUsd));
    setMode(run.spendLimitMode ?? 'pause');
    toggle();
  };

  const commit = async (nextLimit: number | null) => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await setWorkflowRunSpendLimit(sessionId, run.id, nextLimit, mode);
      close();
    } finally {
      setBusy(false);
    }
  };

  const metaLabel = limitUsd == null ? 'Set a spend cap' : `Spend cap ${formatUsd(limitUsd)}`;
  const isBlank = amount.trim() === '';
  const isInvalid = !isBlank && parseSpendLimit(amount) == null;

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Spend cap for this run"
      className="flex flex-col bg-subtle"
      anchorClassName="inline-flex"
      trigger={
        variant === 'meta' ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            data-testid="run-spend-limit-trigger"
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-secondary motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
              limitUsd == null
                ? 'text-faint-foreground hover:bg-hover hover:text-foreground'
                : 'text-muted-foreground hover:bg-hover hover:text-foreground',
            )}
          >
            <CircleDollarSign size={11} aria-hidden className="shrink-0" />
            {metaLabel}
          </button>
        ) : (
          <OrchestratorAction
            icon={CircleDollarSign}
            label="Raise the spend cap"
            variant="primary"
            tone="warning"
            testId="run-spend-limit-trigger"
            title="Cap what this run is allowed to spend"
            expanded={open}
            onClick={onToggle}
          />
        )
      }
    >
      <PopoverBody>
        <header className="px-3 pb-1 pt-3 text-label font-semibold text-foreground">
          Spend cap for this run
        </header>
        <div className="flex flex-col gap-2 px-3 py-2">
          <SpendLimitFields
            amount={amount}
            behavior={behaviorOfRunMode({ mode })}
            inputId="run-spend-limit-amount"
            invalid={isInvalid}
            onAmount={setAmount}
            onBehavior={(behavior) => setMode(runModeOfBehavior({ behavior }))}
          />
          <p className="text-2xs leading-relaxed text-muted-foreground">
            {isInvalid
              ? 'Enter an amount above zero, or clear the field for no limit.'
              : `${formatUsd(spentUsd)} spent so far. Leave it empty for no limit.`}
          </p>
        </div>
        <FormActions className="px-3 pb-3 pt-1">
          {limitUsd == null ? null : (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              data-testid="run-spend-limit-remove"
              onClick={() => void commit(null)}
              className="text-muted-foreground"
            >
              Remove limit
            </Button>
          )}
          <Button
            size="sm"
            disabled={busy || isInvalid}
            data-testid="run-spend-limit-save"
            onClick={() => void commit(parseSpendLimit(amount))}
          >
            Save
          </Button>
        </FormActions>
      </PopoverBody>
    </AnchoredPopover>
  );
};
