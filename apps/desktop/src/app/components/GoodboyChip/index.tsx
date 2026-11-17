import { useEffect, useRef } from 'react';
import { Tooltip, cn, FOCUS_RING } from '@goodboy/ui';
import { useUpdateCardState } from '../../../features/updater/hooks/useUpdateCardState';
import { UpdatePill } from '../../../features/updater/components/UpdatePill';
import { UpdateRailMark } from '../../../features/updater/components/UpdateRailMark';
import { hydrateOnboardingFromDb } from '../../../features/onboarding/onboardingSettings';
import { useIsMainWindow } from '../../../features/workspace/useIsMainWindow';
import { useInstalledVersion } from '../../../features/changelog/hooks/useInstalledVersion';
import { NAMES } from '../../../shared/utils/names';
import { GoodboyChipLabel, type GoodboyChipState } from './GoodboyChipLabel';
import { GoodboyChipEffects } from './GoodboyChipEffects';

type GoodboyChipVariant = 'column' | 'rail';

type Props = {
  readonly onOpenChangelog: () => void;
  readonly onOpenHelp: () => void;
  readonly isCurrent: boolean;
  readonly variant?: GoodboyChipVariant;
  readonly isPrimary?: boolean;
};

const DOOR_LABEL = `Goodboy, ${NAMES.help.toLowerCase()}`;

const TRIGGER_SHAPE: Record<GoodboyChipVariant | 'column-pill', string> = {
  column: 'h-7 min-w-0 flex-1 gap-2 overflow-hidden px-2',
  'column-pill': 'h-7 shrink-0 gap-2 overflow-hidden px-2',
  rail: 'size-8 shrink-0 justify-center',
};

export const GoodboyChip = ({
  onOpenChangelog,
  onOpenHelp,
  isCurrent,
  variant = 'column',
  isPrimary = true,
}: Props) => {
  const update = useUpdateCardState();
  const version = useInstalledVersion();
  const anchorRef = useRef<HTMLDivElement>(null);
  const hasUpdate = update.state !== null;
  const state: GoodboyChipState = hasUpdate ? 'update' : 'rest';
  const isInMainWindow = useIsMainWindow();
  const hasRowPill = variant === 'column' && hasUpdate;
  const isRailUpdate = variant === 'rail' && hasUpdate;
  const label = DOOR_LABEL;
  const tip = variant === 'rail' && version !== null ? `${DOOR_LABEL}, v${version}` : label;

  useEffect(() => {
    if (!isPrimary || isInMainWindow) {
      return;
    }
    const onFocus = () => {
      void hydrateOnboardingFromDb();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [isPrimary, isInMainWindow]);

  if (isRailUpdate) {
    return (
      <div ref={anchorRef} data-goodboy-chip="rail-update" className="flex w-full">
        {isPrimary ? (
          <GoodboyChipEffects
            anchorRef={anchorRef}
            onOpenChangelog={onOpenChangelog}
            isBesideAnchor
          />
        ) : null}
        <UpdateRailMark />
      </div>
    );
  }

  return (
    <div
      ref={anchorRef}
      className={cn('flex items-center gap-1', variant === 'column' && 'min-w-0 flex-1')}
    >
      {isPrimary ? (
        <GoodboyChipEffects anchorRef={anchorRef} onOpenChangelog={onOpenChangelog} />
      ) : null}
      <Tooltip content={tip} side={variant === 'rail' ? 'right' : 'top'}>
        <button
          type="button"
          onClick={() => {
            if (isCurrent) {
              return;
            }
            onOpenHelp();
          }}
          aria-label={label}
          aria-current={isCurrent ? 'page' : undefined}
          data-testid={isPrimary ? 'goodboy-chip' : undefined}
          data-goodboy-chip={variant}
          className={cn(
            'relative flex items-center rounded-md text-meta motion-safe:transition-colors',
            FOCUS_RING,
            TRIGGER_SHAPE[hasRowPill ? 'column-pill' : variant],
            isCurrent ? 'cursor-default bg-selected' : 'hover:bg-hover',
          )}
        >
          <GoodboyChipLabel
            state={state}
            installedVersion={version}
            isMarkOnly={variant === 'rail'}
          />
        </button>
      </Tooltip>
      {hasRowPill ? <UpdatePill tooltipSide="top" /> : null}
    </div>
  );
};
