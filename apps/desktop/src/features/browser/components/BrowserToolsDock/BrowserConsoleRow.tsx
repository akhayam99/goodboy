import { useState } from 'react';
import {
  ChevronRight,
  CircleAlert,
  Info,
  MessageSquareText,
  TriangleAlert,
} from '@goodboy/ui/icons';
import { ICON_SIZE, SelectableRow, TruncatedText, cn } from '@goodboy/ui';
import { isFailedRequest, networkStatusWordOf } from '../../networkStatusWordOf';
import type { BrowserConsoleEntry, BrowserConsoleLevel } from '../../types';
import { requestKeyOf } from './requestKeyOf';

type Props = {
  readonly entry: BrowserConsoleEntry;
  readonly isOpened?: boolean;
  readonly onOpen?: () => void;
};

const LEVEL_ICON = {
  error: CircleAlert,
  warn: TriangleAlert,
  info: Info,
  log: MessageSquareText,
} as const satisfies Record<BrowserConsoleLevel, typeof Info>;

const LEVEL_TEXT = {
  error: 'text-danger',
  warn: 'text-warning',
  info: 'text-foreground',
  log: 'text-foreground',
} as const satisfies Record<BrowserConsoleLevel, string>;

const LEVEL_ICON_TEXT = {
  error: 'text-danger',
  warn: 'text-warning',
  info: 'text-info',
  log: 'text-faint-foreground',
} as const satisfies Record<BrowserConsoleLevel, string>;

export const BrowserConsoleRow = ({ entry, isOpened = false, onOpen }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const isExpandable = onOpen === undefined;
  const isExpanded = isExpandable && isOpen;
  const isNetwork = entry.kind === 'network';
  const status = isNetwork ? networkStatusWordOf({ status: entry.status }) : null;
  const tone = isNetwork && !isFailedRequest({ status: entry.status }) ? 'log' : entry.level;
  const Icon = LEVEL_ICON[entry.level];
  return (
    <div
      data-console-level={entry.level}
      data-request-key={isNetwork ? requestKeyOf({ entry }) : undefined}
      className="flex min-w-0 flex-col rounded-sm hover:bg-hover"
    >
      <SelectableRow
        selected={isOpened}
        isExpanded={isExpandable ? isOpen : undefined}
        ariaLabel={`${entry.level}: ${entry.text}`}
        onClick={onOpen ?? (() => setIsOpen(!isOpen))}
        className="min-w-0 items-center gap-2 px-2 py-0.5 text-code"
      >
        <ChevronRight
          size={ICON_SIZE.row}
          aria-hidden
          className={cn(
            'shrink-0 text-faint-foreground motion-safe:transition-transform',
            isExpanded && 'rotate-90',
          )}
        />
        <Icon size={ICON_SIZE.row} aria-hidden className={cn('shrink-0', LEVEL_ICON_TEXT[tone])} />
        {isNetwork ? (
          <span className="shrink-0 text-muted-foreground">
            {`${entry.method ?? 'GET'} ${status}`}
          </span>
        ) : null}
        <TruncatedText className={cn('min-w-0 flex-1', LEVEL_TEXT[tone])}>
          {entry.text}
        </TruncatedText>
        {entry.source === null ? null : (
          <TruncatedText className="max-w-[40%] shrink-0 text-muted-foreground">
            {entry.source}
          </TruncatedText>
        )}
      </SelectableRow>
      {isExpanded ? (
        <pre
          aria-label="Details"
          className={cn('whitespace-pre-wrap break-words px-2 pb-1 text-code', LEVEL_TEXT[tone])}
        >
          {entry.source === null ? entry.text : `${entry.text}\n${entry.source}`}
        </pre>
      ) : null}
    </div>
  );
};
