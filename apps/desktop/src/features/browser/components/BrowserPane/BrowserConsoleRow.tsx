import { StatusDot, TruncatedText, cn, type Tone } from '@goodboy/ui';
import { networkStatusWordOf } from '../../networkStatusWordOf';
import type { BrowserConsoleEntry, BrowserConsoleLevel } from '../../types';

type Props = {
  readonly entry: BrowserConsoleEntry;
};

const LEVEL_TONE = {
  error: 'danger',
  warn: 'warning',
  info: 'info',
  log: 'neutral',
} as const satisfies Record<BrowserConsoleLevel, Tone>;

const LEVEL_TEXT = {
  error: 'text-danger',
  warn: 'text-warning',
  info: 'text-foreground',
  log: 'text-foreground',
} as const satisfies Record<BrowserConsoleLevel, string>;

export const BrowserConsoleRow = ({ entry }: Props) => (
  <div
    data-console-level={entry.level}
    className="flex min-w-0 items-center gap-2 rounded-sm px-2 py-0.5 text-code hover:bg-hover"
  >
    <StatusDot tone={LEVEL_TONE[entry.level]} size="sm" ariaLabel={entry.level} />
    {entry.kind === 'network' ? (
      <span className="shrink-0 text-muted-foreground">
        {`${entry.method ?? 'GET'} ${networkStatusWordOf({ status: entry.status })}`}
      </span>
    ) : null}
    <TruncatedText className={cn('min-w-0 flex-1', LEVEL_TEXT[entry.level])}>
      {entry.text}
    </TruncatedText>
    {entry.source === null ? null : (
      <TruncatedText className="max-w-[40%] shrink-0 text-muted-foreground">
        {entry.source}
      </TruncatedText>
    )}
  </div>
);
