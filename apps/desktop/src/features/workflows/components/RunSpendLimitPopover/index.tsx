import { CircleDollarSign } from 'lucide-react';
import {
  AnchoredPopover,
  Button,
  cn,
  formatUsd,
  ICON_SIZE,
  POPOVER_WIDTH_CLASS,
  POPOVER_WIDTH_PX,
  PopoverBody,
  useDropdown,
  FOCUS_RING,
} from '@goodboy/ui';
import type { SessionId, WorkflowRun } from '@goodboy/types';
import { useRunSpendUsd } from '../../../../store/slices/sessions/selectors';
import { runLimitSourceOf } from '../../runLimitSourceOf';
import { RunLimitFields } from '../RunSettingsLine/RunLimitFields';
import { useRunLimitDraft } from '../RunSettingsLine/useRunLimitDraft';

type Props = {
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
  readonly variant: 'primary' | 'meta';
  readonly buttonVariant?: 'primary' | 'secondary';
};

export const RunSpendLimitPopover = ({
  sessionId,
  run,
  variant,
  buttonVariant = 'primary',
}: Props) => {
  const spentUsd = useRunSpendUsd(sessionId, run.id);
  const limitUsd = run.spendLimitUsd ?? null;
  const dropdown = useDropdown({
    expectedHeight: 220,
    expectedWidth: POPOVER_WIDTH_PX.standard,
    width: POPOVER_WIDTH_CLASS.standard,
  });
  const { open, toggle } = dropdown;
  const limit = useRunLimitDraft({ sessionId, run, isOpen: open });
  const source = runLimitSourceOf({ run });
  const metaLabel =
    limitUsd == null
      ? 'Set a limit'
      : `Limit ${formatUsd(limitUsd)}${source === null ? '' : ` · ${source}`}`;

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Limit for this run"
      className="flex flex-col bg-subtle"
      anchorClassName="inline-flex"
      trigger={
        variant === 'meta' ? (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            data-testid="run-spend-limit-trigger"
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-meta motion-safe:transition-colors',
              FOCUS_RING,
              limitUsd == null
                ? 'text-faint-foreground hover:bg-hover hover:text-foreground'
                : 'text-muted-foreground hover:bg-hover hover:text-foreground',
            )}
          >
            <CircleDollarSign size={ICON_SIZE.row} aria-hidden className="shrink-0" />
            {metaLabel}
          </button>
        ) : (
          <Button
            size="sm"
            variant={buttonVariant}
            data-testid="run-spend-limit-trigger"
            aria-expanded={open}
            onClick={toggle}
          >
            <CircleDollarSign size={ICON_SIZE.control} aria-hidden />
            Raise limit
          </Button>
        )
      }
    >
      <PopoverBody>
        <header className="px-3 pb-1 pt-3 text-row text-foreground">Limit for this run</header>
        <div className="flex flex-col gap-2 px-3 pb-3 pt-2">
          <RunLimitFields run={run} limit={limit} />
          <p className="text-meta leading-relaxed text-muted-foreground">
            {limit.error ??
              `${formatUsd(spentUsd)} spent so far. Applies when you press Enter or close. Leave it empty for no limit.`}
          </p>
        </div>
      </PopoverBody>
    </AnchoredPopover>
  );
};
