import { useEffect, useRef } from 'react';
import { Tooltip, cn, FOCUS_RING } from '@goodboy/ui';
import { useUpdateCardState } from '../../../features/updater/hooks/useUpdateCardState';
import { UpdateRailMark } from '../../../features/updater/components/UpdateRailMark';
import { hydrateOnboardingFromDb } from '../../../features/onboarding/onboardingSettings';
import { useIsMainWindow } from '../../../features/workspace/useIsMainWindow';
import { useInstalledVersion } from '../../../features/changelog/hooks/useInstalledVersion';
import { NAMES } from '../../../shared/utils/names';
import { BrandLockup } from './BrandLockup';
import { GoodboyChipEffects } from './GoodboyChipEffects';

type Props = {
  readonly onOpenChangelog: () => void;
  readonly onOpenHelp: () => void;
  readonly isCurrent: boolean;
};

const TRIGGER_SHAPE = 'size-8 shrink-0 justify-center';

const DOOR_LABEL = `Goodboy, ${NAMES.help.toLowerCase()}`;

export const GoodboyChip = ({ onOpenChangelog, onOpenHelp, isCurrent }: Props) => {
  const update = useUpdateCardState();
  const version = useInstalledVersion();
  const anchorRef = useRef<HTMLDivElement>(null);
  const hasUpdate = update.state !== null;
  const isInMainWindow = useIsMainWindow();
  const tip = version === null ? DOOR_LABEL : `${DOOR_LABEL}, v${version}`;

  useEffect(() => {
    if (isInMainWindow) {
      return;
    }
    const onFocus = () => {
      void hydrateOnboardingFromDb();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [isInMainWindow]);

  if (hasUpdate) {
    return (
      <div ref={anchorRef} data-goodboy-chip="rail-update" className="flex w-full">
        <GoodboyChipEffects
          anchorRef={anchorRef}
          onOpenChangelog={onOpenChangelog}
          isBesideAnchor
        />
        <UpdateRailMark />
      </div>
    );
  }

  return (
    <div ref={anchorRef} className="flex items-center gap-1">
      <GoodboyChipEffects anchorRef={anchorRef} onOpenChangelog={onOpenChangelog} />
      <Tooltip content={tip} side="right">
        <button
          type="button"
          onClick={() => {
            if (isCurrent) {
              return;
            }
            onOpenHelp();
          }}
          aria-label={DOOR_LABEL}
          aria-current={isCurrent ? 'page' : undefined}
          data-testid="goodboy-chip"
          data-goodboy-chip="rail"
          className={cn(
            'relative flex items-center rounded-md text-meta motion-safe:transition-colors',
            FOCUS_RING,
            TRIGGER_SHAPE,
            isCurrent ? 'cursor-default bg-selected' : 'hover:bg-hover',
          )}
        >
          <BrandLockup />
        </button>
      </Tooltip>
    </div>
  );
};
