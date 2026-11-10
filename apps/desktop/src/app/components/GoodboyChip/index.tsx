import { useEffect, useRef } from 'react';
import { StatusDot, Tooltip, cn, FOCUS_RING } from '@goodboy/ui';
import { useUpdateCardState } from '../../../features/updater/hooks/useUpdateCardState';
import { updatePillLabel } from '../../../features/updater/updateCardCopy';
import { UpdatePill } from '../../../features/updater/components/UpdatePill';
import { hydrateOnboardingFromDb } from '../../../features/onboarding/onboardingSettings';
import { useIsMainWindow } from '../../../features/workspace/useIsMainWindow';
import { useInstalledVersion } from '../../../features/changelog/hooks/useInstalledVersion';
import { NAMES } from '../../../shared/utils/names';
import { useAppStore } from '../../../store';
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
  const isChangelogOpen = useAppStore((state) => state.appStudio?.kind === 'changelog');
  const hasUpdate = update.state !== null;
  const state: GoodboyChipState = hasUpdate ? 'update' : 'rest';
  const isInMainWindow = useIsMainWindow();
  const hasRowPill = variant === 'column' && hasUpdate;
  const isRailUpdate = variant === 'rail' && update.state !== null;
  const label =
    update.state !== null && variant === 'rail'
      ? `${DOOR_LABEL}, ${updatePillLabel({
          state: update.state,
          version: update.version,
          runningCount: update.runningCount,
        })}`
      : DOOR_LABEL;

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

  return (
    <div
      ref={anchorRef}
      className={cn('flex items-center gap-1', variant === 'column' && 'min-w-0 flex-1')}
    >
      {isPrimary ? (
        <GoodboyChipEffects anchorRef={anchorRef} onOpenChangelog={onOpenChangelog} />
      ) : null}
      <Tooltip content={label} side={variant === 'rail' ? 'right' : 'top'}>
        <button
          type="button"
          onClick={() => {
            if (isRailUpdate && !isChangelogOpen) {
              onOpenChangelog();
              return;
            }
            if (isCurrent || isRailUpdate) {
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
          {isRailUpdate ? (
            <StatusDot tone="primary" size="sm" className="absolute right-1 top-1" />
          ) : null}
        </button>
      </Tooltip>
      {hasRowPill ? <UpdatePill tooltipSide="top" /> : null}
    </div>
  );
};
