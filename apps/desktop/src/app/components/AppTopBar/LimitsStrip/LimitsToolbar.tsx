import type { KeyboardEvent } from 'react';
import type { LimitsChip as LimitsChipModel } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import { LimitsChip } from './LimitsChip';
import { LimitsOverflowPopover } from './LimitsOverflowPopover';

type Props = {
  readonly chips: ReadonlyArray<LimitsChipModel>;
  readonly nowMs: number;
  readonly pressedId: ProviderId | null;
  readonly onOpen: (chip: LimitsChipModel) => void;
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

type ChipParams = {
  readonly chip: LimitsChipModel;
};

const hasData = ({ chip }: ChipParams): boolean =>
  chip.state !== 'none' && chip.state !== 'waiting';

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

export const LimitsToolbar = ({ chips, nowMs, pressedId, onOpen }: Props) => {
  const withData = chips.filter((chip) => hasData({ chip }));
  const noData = chips.filter((chip) => !hasData({ chip }));
  return (
    <div
      role="toolbar"
      aria-label="Provider limits"
      onKeyDown={moveFocus}
      className="flex shrink-0 items-center gap-1"
    >
      {withData.map((chip, index) => (
        <LimitsChip
          key={chip.providerId}
          chip={chip}
          nowMs={nowMs}
          isPressed={chip.providerId === pressedId}
          className={chipVisibility({ index })}
          onOpen={onOpen}
        />
      ))}
      {OVERFLOW_STEPS.filter((step) => withData.length > step.shown || noData.length > 0).map(
        (step) => (
          <LimitsOverflowPopover
            key={step.shown}
            hidden={[...withData.slice(step.shown), ...noData]}
            nowMs={nowMs}
            className={step.className}
            onOpen={onOpen}
          />
        ),
      )}
    </div>
  );
};
