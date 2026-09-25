import { ArrowUpRight } from 'lucide-react';
import { FOCUS_RING, StatusDot, Tooltip, cn } from '@goodboy/ui';
import {
  IntegrationGlyph,
  integrationLabel,
} from '../../../integrations/components/IntegrationGlyph';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { openUrl } from '../../../../shared/lib/editor';
import { formatAbsoluteDateTime, formatRelativeAge } from '../../../../shared/utils/relativeDate';
import { recordSessionId } from '../../recordSessionId';
import type { InboxRecord } from '../../types';
import { InboxStateLabel } from '../InboxStateLabel';

type Props = {
  readonly record: InboxRecord;
  readonly selected: boolean;
  readonly onSelect: (record: InboxRecord) => void;
};

type OptionIdParams = {
  readonly key: string;
};

export const inboxOptionId = ({ key }: OptionIdParams): string =>
  `inbox-option-${key.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

export const InboxRow = ({ record, selected, onSelect }: Props) => {
  const relativeTime = formatRelativeAge({ fromIso: record.updatedAt });
  const hasSession = recordSessionId({ record }) != null;
  const toolLabel = integrationLabel({ provider: record.provider });
  const canOpen = record.url !== '';

  return (
    <div
      data-inbox-key={record.key}
      data-selected={selected}
      className={cn(
        'group relative grid h-8 grid-cols-[6px_14px_76px_minmax(0,1fr)_40px] items-center gap-2.5 rounded-md px-2.5 text-muted-foreground motion-safe:transition-colors @2xl:grid-cols-[6px_14px_76px_minmax(0,1fr)_120px_88px_40px]',
        selected ? 'bg-selected text-foreground' : 'hover:bg-hover hover:text-foreground',
      )}
    >
      <button
        type="button"
        id={inboxOptionId({ key: record.key })}
        role="option"
        aria-selected={selected}
        tabIndex={-1}
        title={record.title}
        onClick={() => onSelect(record)}
        className={cn('absolute inset-0 cursor-pointer rounded-md', FOCUS_RING)}
      >
        <span className="sr-only">{`${record.identifier} ${record.title}`}</span>
      </button>
      <span className="pointer-events-none relative flex h-4 items-center">
        {hasSession ? <StatusDot tone="primary" size="sm" ariaLabel="Has a session" /> : null}
      </span>
      <span aria-hidden className="pointer-events-none relative flex">
        <IntegrationGlyph provider={record.provider} size="xs" useBrandColor />
      </span>
      <span className="pointer-events-none relative truncate font-mono text-2xs tabular-nums text-faint-foreground">
        {record.identifier}
      </span>
      <span
        className={cn(
          'pointer-events-none relative truncate text-xs',
          record.state === 'done' ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {record.title}
      </span>
      <span className="pointer-events-none relative hidden truncate text-2xs text-faint-foreground @2xl:block">
        {record.context}
      </span>
      <InboxStateLabel
        state={record.state}
        label={record.stateLabel}
        className="pointer-events-none relative hidden text-2xs text-muted-foreground @2xl:flex"
      />
      <span className="relative flex h-5 items-center justify-end">
        <time
          dateTime={record.updatedAt}
          title={formatAbsoluteDateTime({ iso: record.updatedAt })}
          className={cn(
            'pointer-events-none text-3xs tabular-nums text-faint-foreground',
            canOpen && 'group-hover:hidden',
            canOpen && selected && 'hidden',
          )}
        >
          {relativeTime}
        </time>
        {canOpen ? (
          <Tooltip content={`Open in ${toolLabel}`}>
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              data-open-in-tool={record.key}
              title={`Open ${record.identifier} in ${toolLabel}`}
              onClick={() => void openUrl(record.url)}
              className={cn(
                'size-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-hover hover:text-foreground',
                selected ? 'flex' : 'hidden group-hover:flex',
                FOCUS_RING,
              )}
            >
              <ArrowUpRight size={ICON_SIZE.row} aria-hidden />
            </button>
          </Tooltip>
        ) : null}
      </span>
    </div>
  );
};
