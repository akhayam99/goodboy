import { cn, tintClasses } from '@goodboy/ui';
import { runViewGlanceOf } from '../../glance/runViewGlanceOf';
import type { RunView } from '../AgentTree/useRunView';

type Props = {
  readonly view: RunView;
};

export const RunStatusChip = ({ view }: Props) => {
  const glance = runViewGlanceOf({ view });
  const tint = tintClasses(glance.tone);
  return (
    <span data-run-status={glance.state} className="inline-flex shrink-0 items-center gap-2">
      <span
        aria-hidden="true"
        className={cn(
          'inline-block size-1.5 shrink-0 rounded-full',
          tint.dot,
          glance.isLive && 'motion-safe:animate-soft-pulse',
        )}
      />
      <span className={tint.text}>{glance.word}</span>
    </span>
  );
};
