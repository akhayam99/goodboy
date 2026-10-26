import { ArrowRight } from 'lucide-react';
import { cn, ICON_SIZE, FOCUS_RING } from '@goodboy/ui';
import type { AgentId } from '@goodboy/types';
import { MOVE_TO_AUTO_EVENT, moveToAutoDetail } from '../../../auto/adopt/moveToAutoEvent';
import { useIsAutoOn } from '../../../auto/useIsAutoOn';

import { HandoffCardShell } from './HandoffCardShell';
import { NAMES } from '../../../../shared/utils/names';

type Props = {
  readonly reason: string;
  readonly agentId: AgentId;
};

export const AutoHandoffChip = ({ reason, agentId }: Props) => {
  const isAutoOn = useIsAutoOn();
  if (!isAutoOn) {
    return null;
  }
  return (
    <HandoffCardShell>
      <span className="text-row text-foreground">Agent suggests: Auto</span>
      {reason.length > 0 ? <span className="text-muted-foreground">{reason}</span> : null}
      <div className="flex min-h-5 items-center gap-1">
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent(MOVE_TO_AUTO_EVENT, { detail: moveToAutoDetail({ agentId }) }),
            )
          }
          className={cn(
            'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-chip text-muted-foreground',
            'hover:text-foreground',
            FOCUS_RING,
          )}
        >
          <ArrowRight size={ICON_SIZE.mark} aria-hidden />
          <span>{NAMES.letAutoTakeIt}</span>
        </button>
      </div>
    </HandoffCardShell>
  );
};
