import { Check } from 'lucide-react';
import { Chip, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { HistoryApplied } from '../../../../store/slices/history/types';
import { appliedChips } from '../../groupAppliedEdits';
import { HISTORY_ACTION_CLASSES } from '../../historyActionClasses';

type Props = {
  readonly applied: HistoryApplied;
};

export const HistoryResultHead = ({ applied }: Props) => {
  const chips = appliedChips({ lines: applied.lines });
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Check size={ICON_SIZE.hero} aria-hidden className="shrink-0 text-success" />
        <h2 id="history-result" className="text-heading text-foreground tabular-nums">
          {applied.before} {applied.before === 1 ? 'commit' : 'commits'} became {applied.after}
        </h2>
        <span className="text-label text-faint-foreground">History rewritten</span>
      </div>
      {chips.length === 0 ? null : (
        <div className="flex flex-wrap items-center gap-2" aria-label="What changed">
          {chips.map((chip) => (
            <Chip
              key={chip.kind}
              tone="neutral"
              size="sm"
              icon={
                <span
                  aria-hidden
                  className={cn('size-2 rounded-full', HISTORY_ACTION_CLASSES[chip.action].solid)}
                />
              }
              label={
                <span>
                  <span className="text-foreground tabular-nums">{chip.count}</span> {chip.noun}
                </span>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};
