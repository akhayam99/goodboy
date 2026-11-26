import { cn } from '@goodboy/ui';
import { isFailedRequest } from '../../networkStatusWordOf';
import type { BrowserConsoleEntry } from '../../types';

type Props = {
  readonly entry: BrowserConsoleEntry;
  readonly span: number;
};

const MIN_WIDTH_PERCENT = 1.2;

export const NetworkWaterfall = ({ entry, span }: Props) => {
  const facts = entry.network;
  if (facts === null || span <= 0) {
    return null;
  }
  const left = Math.min(100, (facts.start / span) * 100);
  const end = facts.duration === null ? span : facts.start + facts.duration;
  const width = Math.max(MIN_WIDTH_PERCENT, ((end - facts.start) / span) * 100);
  return (
    <span aria-hidden className="relative block h-1.5 w-full">
      <span
        data-waterfall-bar=""
        style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }}
        className={cn(
          'absolute inset-y-0 min-w-0.5 rounded-full',
          isFailedRequest({ status: entry.status }) ? 'bg-danger' : 'bg-info',
        )}
      />
    </span>
  );
};
