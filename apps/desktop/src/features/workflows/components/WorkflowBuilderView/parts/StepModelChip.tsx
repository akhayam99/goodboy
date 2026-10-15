import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { AnchoredPopover, Tooltip, cn, tintClasses, useDropdown } from '@goodboy/ui';
import type { EffortLevel, ProviderId } from '@goodboy/types';
import { RoutingModelBlock } from '../../../../../shared/components/RoutingModelBlock';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';

type Props = {
  readonly stepLabel: string;
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: EffortLevel;
  readonly isPinned: boolean;
  readonly isDisabled: boolean;
  readonly children: ReactNode;
};

const FLASH_MS = 700;

export const StepModelChip = ({
  stepLabel,
  provider,
  model,
  effort,
  isPinned,
  isDisabled,
  children,
}: Props) => {
  const dropdown = useDropdown({
    disabled: isDisabled,
    align: 'end',
    width: 'w-96',
    expectedHeight: 360,
  });
  const { open: isOpen, toggle } = dropdown;
  const [isFlashing, setIsFlashing] = useState(false);
  const shownRoute = useRef(`${provider}|${model}|${effort}`);
  const label = `Model for ${stepLabel}`;

  useEffect(() => {
    const next = `${provider}|${model}|${effort}`;
    if (shownRoute.current === next) {
      return;
    }
    shownRoute.current = next;
    setIsFlashing(true);
    const timer = window.setTimeout(() => setIsFlashing(false), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [provider, model, effort]);

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={label}
      className="flex flex-col gap-3 py-3"
      trigger={
        <Tooltip content={label}>
          <button
            type="button"
            onClick={toggle}
            disabled={isDisabled}
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            aria-label={label}
            data-flashing={isFlashing ? 'true' : undefined}
            className={cn(
              'flex min-h-8 min-w-0 items-center gap-1 rounded-md px-2 text-left transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60',
              isFlashing && tintClasses('primary').bg,
            )}
          >
            <RoutingModelBlock
              isPlanned
              layout="inline"
              provider={provider}
              model={model}
              effort={effort}
            />
            {isPinned ? (
              <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-primary" />
            ) : null}
            <ChevronDown
              size={ICON_SIZE.row}
              aria-hidden
              className="shrink-0 text-muted-foreground"
            />
          </button>
        </Tooltip>
      }
    >
      {children}
    </AnchoredPopover>
  );
};
