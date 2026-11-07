import { cn, tintClasses } from '@goodboy/ui';
import { DockStopButton } from '../../../../shared/components/DockStopButton';
import type { ConversationLive, ConversationStop } from '../../../../shared/types/conversationStop';
import { TailClock } from '../../../live-state/TailClock';
import { glanceOf } from '../../../session/glance/glanceOf';
import { dockLiveSentenceOf } from './dockLiveSentenceOf';

type Props = {
  readonly live: ConversationLive;
  readonly stop: ConversationStop;
  readonly isStopArmed: boolean;
};

const RUNNING_TONE = glanceOf({ state: 'working', sentence: '' }).tone;

export const DockLiveLine = ({ live, stop, isStopArmed }: Props) => {
  const isStopIdle = stop.phase === 'idle';
  const sentence = dockLiveSentenceOf({ live, stop });
  return (
    <div
      data-dock-row=""
      data-dock-live=""
      data-stop-phase={stop.phase}
      className="flex min-h-7 min-w-0 items-center gap-2 px-3 pb-2 text-ui"
    >
      {sentence === '' ? null : (
        <span
          aria-hidden="true"
          className={cn(
            'inline-block size-1.5 shrink-0 rounded-full',
            isStopIdle && 'motion-safe:animate-soft-pulse',
            tintClasses(RUNNING_TONE).dot,
          )}
        />
      )}
      <span role="status" aria-label="Agent working" className="min-w-0 truncate text-foreground">
        {sentence}
      </span>
      <TailClock startedAt={live.startedAt} stepAgentId={live.stepAgentId} isRunning={isStopIdle} />
      <span className="flex-1" />
      {isStopArmed ? (
        <span role="status" className="shrink-0 whitespace-nowrap text-meta text-muted-foreground">
          Esc again to stop
        </span>
      ) : null}
      <DockStopButton stop={stop} />
    </div>
  );
};
