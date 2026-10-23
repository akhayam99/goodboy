import { CircleDollarSign } from 'lucide-react';
import { AnchoredPopover, Button, cn, formatUsd, PopoverBody, useDropdown } from '@goodboy/ui';
import type { SessionId, WorkflowRun } from '@goodboy/types';
import { useRunSpendUsd } from '../../../../store/slices/sessions/selectors';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { RunLimitFields } from '../RunSettingsLine/RunLimitFields';
import { useRunLimitDraft } from '../RunSettingsLine/useRunLimitDraft';

type Props = {
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
  readonly variant: 'primary' | 'meta' | 'foot';
  readonly buttonVariant?: 'primary' | 'secondary';
};

const FOOT_TRIGGER =
  'inline-flex h-6 items-center rounded-md text-ui text-muted-foreground motion-safe:transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

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
    expectedWidth: 264,
    width: 'w-80',
  });
  const { open, toggle } = dropdown;
  const limit = useRunLimitDraft({ sessionId, run, isOpen: open });
  const metaLabel = limitUsd == null ? 'Set a limit' : `Limit ${formatUsd(limitUsd)}`;

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Limit for this run"
      className="flex flex-col bg-subtle"
      anchorClassName="inline-flex"
      trigger={
        variant === 'foot' ? (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            data-testid="run-spend-limit-trigger"
            className={FOOT_TRIGGER}
          >
            {metaLabel}
          </button>
        ) : variant === 'meta' ? (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            data-testid="run-spend-limit-trigger"
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-meta motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
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
