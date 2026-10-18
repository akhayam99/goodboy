import { useRef } from 'react';
import { Tooltip } from '@goodboy/ui';
import { openChangelogStudio } from '../../../changelog/changelogStudioEvent';
import { useUpdateCardState } from '../../hooks/useUpdateCardState';
import { updatePillLabel } from '../../updateCardCopy';
import { toggleUpdateCard } from '../../updateCardRequest';
import { UpdateArrivalCard } from '../UpdateArrivalCard';
import { UpdatePillVisual } from './UpdatePillVisual';

type Props = {
  readonly hasCard?: boolean;
  readonly tooltipSide?: 'top' | 'bottom';
  readonly onOpenChangelog?: () => void;
};

export const UpdatePill = ({
  hasCard = false,
  tooltipSide = 'bottom',
  onOpenChangelog = openChangelogStudio,
}: Props) => {
  const { state, version, runningCount } = useUpdateCardState();
  const anchorRef = useRef<HTMLSpanElement>(null);

  if (state === null) {
    return null;
  }

  const label = updatePillLabel({ state, version, runningCount });

  return (
    <span ref={anchorRef} className="flex min-w-0 max-w-full">
      <Tooltip content={label} side={tooltipSide}>
        <button
          type="button"
          data-update-pill=""
          aria-label={label}
          onClick={toggleUpdateCard}
          className="flex min-w-0 max-w-full rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <UpdatePillVisual state={state} version={version} />
        </button>
      </Tooltip>
      {hasCard ? (
        <UpdateArrivalCard anchorRef={anchorRef} onOpenChangelog={onOpenChangelog} />
      ) : null}
    </span>
  );
};
