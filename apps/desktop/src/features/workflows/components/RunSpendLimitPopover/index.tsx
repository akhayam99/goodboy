import { useState } from 'react';
import { CircleDollarSign } from 'lucide-react';
import {
  Button,
  cn,
  Divider,
  formatUsd,
  Popover,
  PopoverBody,
  PopoverFooter,
  useDropdown,
} from '@goodboy/ui';
import type { SessionId, WorkflowRun, WorkflowSpendLimitMode } from '@goodboy/types';
import { useAppStore } from '../../../../store/store';
import { useRunSpendUsd } from '../../../../store/selectors';
import { OrchestratorAction } from '../OrchestratorPanel/OrchestratorAction';
import { SpendLimitFields, parseSpendLimit } from './SpendLimitFields';

type Props = {
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
  readonly variant: 'primary' | 'meta';
};

export const RunSpendLimitPopover = ({ sessionId, run, variant }: Props) => {
  const setWorkflowRunSpendLimit = useAppStore((state) => state.setWorkflowRunSpendLimit);
  const spentUsd = useRunSpendUsd(sessionId, run.id);
  const limitUsd = run.spendLimitUsd ?? null;
  const { open, close, toggle, containerRef, popupRef, popupClassName, popupStyle } = useDropdown({
    align: 'end',
    expectedHeight: 220,
    expectedWidth: 264,
    width: 'w-64',
  });
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

  const metaLabel = limitUsd == null ? 'Set a spend limit' : `Spend limit ${formatUsd(limitUsd)}`;
  const isBlank = amount.trim() === '';
  const isInvalid = !isBlank && parseSpendLimit(amount) == null;

  return (
    <div ref={containerRef} className="relative inline-flex">
      {variant === 'meta' ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          data-testid="run-spend-limit-trigger"
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-2xs motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
            limitUsd == null
              ? 'text-muted-foreground/70 hover:bg-foreground/10 hover:text-foreground'
              : 'text-muted-foreground hover:bg-foreground/10 hover:text-foreground',
          )}
        >
          <CircleDollarSign size={11} aria-hidden className="shrink-0" />
          {metaLabel}
        </button>
      ) : (
        <OrchestratorAction
          icon={CircleDollarSign}
          label="Raise the spend limit"
          variant="primary"
          tone="warning"
          testId="run-spend-limit-trigger"
          title="Cap what this run is allowed to spend"
          expanded={open}
          onClick={onToggle}
        />
      )}

      {open ? (
        <Popover
          innerRef={popupRef}
          role="dialog"
          ariaLabel="Spend limit for this run"
          className={cn(popupClassName, 'flex flex-col bg-subtle')}
          style={popupStyle}
        >
          <PopoverBody>
            <header className="px-3 py-2 text-xs font-semibold text-foreground">
              Spend limit for this run
            </header>
            <Divider />
            <div className="flex flex-col gap-2 px-3 py-3">
              <SpendLimitFields
                amount={amount}
                mode={mode}
                inputId="run-spend-limit-amount"
                invalid={isInvalid}
                onAmount={setAmount}
                onMode={setMode}
              />
              <p className="text-2xs leading-relaxed text-muted-foreground">
                {isInvalid
                  ? 'Enter an amount above zero, or clear the field for no limit.'
                  : `${formatUsd(spentUsd)} spent so far. Leave it empty for no limit.`}
              </p>
            </div>
          </PopoverBody>
          <Divider />
          <PopoverFooter className="flex items-center justify-end gap-2 px-3 py-2">
            {limitUsd == null ? null : (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                data-testid="run-spend-limit-remove"
                onClick={() => void commit(null)}
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
          </PopoverFooter>
        </Popover>
      ) : null}
    </div>
  );
};
