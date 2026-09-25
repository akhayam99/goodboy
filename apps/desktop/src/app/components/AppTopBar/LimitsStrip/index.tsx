import type { KeyboardEvent } from 'react';
import type { LimitsChip as LimitsChipModel } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import { useLimitsChips } from '../../../../features/providers/hooks/useLimitsChips';
import { openProviderUsage } from '../../../../features/providers/openProviderUsage';
import { ConnectProviderChip } from './ConnectProviderChip';
import { LimitsChip } from './LimitsChip';
import { LimitsOverflowPopover } from './LimitsOverflowPopover';

type Props = {
  readonly openProviderId?: ProviderId | null;
};

const CHIP_VISIBILITY: ReadonlyArray<string> = [
  'flex',
  'hidden @min-chrome-labels/topbar:flex',
  'hidden @min-chrome-wide/topbar:flex',
  'hidden @min-chrome-wide/topbar:flex',
];

type OverflowStep = {
  readonly shown: number;
  readonly className: string;
};

const OVERFLOW_STEPS: ReadonlyArray<OverflowStep> = [
  { shown: 1, className: 'flex @min-chrome-labels/topbar:hidden' },
  { shown: 2, className: 'hidden @min-chrome-labels/topbar:flex @min-chrome-wide/topbar:hidden' },
  { shown: 4, className: 'hidden @min-chrome-wide/topbar:flex' },
];

type IndexParams = {
  readonly index: number;
};

const chipVisibility = ({ index }: IndexParams): string => CHIP_VISIBILITY[index] ?? 'hidden';

const moveFocus = (event: KeyboardEvent<HTMLDivElement>): void => {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
    return;
  }
  const buttons = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-limits-chip]'),
  );
  const visible = buttons.filter((button) => button.getClientRects().length > 0);
  const targets = visible.length > 0 ? visible : buttons;
  const current = targets.findIndex((button) => button === document.activeElement);
  if (current === -1) {
    return;
  }
  event.preventDefault();
  const step = event.key === 'ArrowRight' ? 1 : -1;
  targets[(current + step + targets.length) % targets.length]?.focus();
};

export const LimitsStrip = ({ openProviderId = null }: Props) => {
  const { chips, hasNoProvider, nowMs } = useLimitsChips();
  if (hasNoProvider) {
    return <ConnectProviderChip />;
  }
  if (chips.length === 0) {
    return null;
  }
  const onOpen = (chip: LimitsChipModel) => openProviderUsage({ providerId: chip.providerId });
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <span className="hidden text-2xs text-faint-foreground @min-chrome-labels/topbar:inline">
        Limits
      </span>
      <div
        role="toolbar"
        aria-label="Provider limits"
        onKeyDown={moveFocus}
        className="flex items-center gap-px rounded-md bg-subtle"
      >
        {chips.map((chip, index) => (
          <LimitsChip
            key={chip.providerId}
            chip={chip}
            nowMs={nowMs}
            isPressed={chip.providerId === openProviderId}
            className={chipVisibility({ index })}
            onOpen={onOpen}
          />
        ))}
        {OVERFLOW_STEPS.filter((step) => chips.length > step.shown).map((step) => (
          <LimitsOverflowPopover
            key={step.shown}
            hidden={chips.slice(step.shown)}
            nowMs={nowMs}
            className={step.className}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  );
};
