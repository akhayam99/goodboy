import type { ProviderLimitWindow } from '@goodboy/types';
import { cn } from '@goodboy/ui';
import { usageWindowFactsOf } from '../../../../limits/usageWindowFactsOf';
import { WINDOW_TONE_FILL } from '../../../../limits/windowTone';

type Props = {
  readonly window: ProviderLimitWindow;
  readonly siblings: ReadonlyArray<ProviderLimitWindow>;
  readonly nowMs: number;
};

export const UsageWindowRow = ({ window, siblings, nowMs }: Props) => {
  const facts = usageWindowFactsOf({ window, siblings, nowMs });
  const width = `${Math.round(Math.min(Math.max(facts.fraction ?? 0, 0), 1) * 100)}%`;
  return (
    <li className="grid min-h-10 grid-cols-[160px_1fr_96px_200px] items-center gap-x-3 gap-y-1 rounded-sm px-2 text-meta @max-[720px]:grid-cols-[140px_minmax(0,1fr)_88px] @max-[720px]:py-2">
      <span className="truncate text-foreground">{facts.label}</span>
      <span aria-hidden className="relative h-1.5 overflow-hidden rounded-full bg-muted">
        {facts.fraction === null ? null : (
          <span
            className={cn('absolute inset-y-0 left-0 rounded-full', WINDOW_TONE_FILL[facts.tone])}
            style={{ width }}
          />
        )}
      </span>
      <span className="tabular-nums text-muted-foreground">
        {facts.percentText === null ? 'Within limits' : `${facts.percentText} used`}
      </span>
      <span className="truncate tabular-nums text-faint-foreground @max-[720px]:col-span-2 @max-[720px]:col-start-2 @max-[720px]:row-start-2">
        {facts.resetText}
      </span>
    </li>
  );
};
