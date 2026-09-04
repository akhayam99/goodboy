import type { LucideIcon } from 'lucide-react';
import { Bug, CircleDot, GitPullRequest, MessagesSquare } from 'lucide-react';
import { cn, SelectableRow, StateBadge, tintClasses, type StateTone } from '@goodboy/ui';
import {
  IntegrationGlyph,
  integrationLabel,
} from '../../../integrations/components/IntegrationGlyph';
import { formatRelativeAge } from '../../../../shared/utils/relativeDate';
import type { InboxKind, InboxRecord, InboxState } from '../../types';

const STATE_TONE: Record<InboxState, StateTone> = {
  open: 'info',
  active: 'warning',
  done: 'neutral',
  alert: 'danger',
};

const KIND_ICON: Record<InboxKind, LucideIcon> = {
  issue: CircleDot,
  pr: GitPullRequest,
  mr: GitPullRequest,
  thread: MessagesSquare,
  error: Bug,
};

const STATE_LABEL: Record<InboxState, string> = {
  open: 'Open',
  active: 'Active',
  done: 'Done',
  alert: 'Alert',
};

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
  const stateTone = STATE_TONE[record.state];
  const KindIcon = KIND_ICON[record.kind];
  const providerLabel = integrationLabel({ provider: record.provider });

  return (
    <SelectableRow
      selected={selected}
      onClick={() => onSelect(record)}
      title={record.title}
      ariaCurrent={selected}
      id={inboxOptionId({ key: record.key })}
      role="option"
      ariaSelected={selected}
      tabIndex={-1}
      className="flex-col items-stretch gap-1 px-3 py-2"
    >
      <span className="flex items-center gap-2">
        <KindIcon size={14} aria-hidden className={cn('shrink-0', tintClasses(stateTone).icon)} />
        <span className="shrink-0 font-mono text-2xs tabular-nums text-muted-foreground">
          {record.identifier}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs">{record.title}</span>
        {relativeTime !== '' ? (
          <span className="shrink-0 text-3xs tabular-nums text-muted-foreground/60">
            {relativeTime}
          </span>
        ) : null}
      </span>
      <span className="flex items-center gap-2 pl-6">
        <IntegrationGlyph provider={record.provider} size="xs" useBrandColor />
        <span className="shrink-0 text-2xs text-muted-foreground">{providerLabel}</span>
        <StateBadge tone={stateTone}>{STATE_LABEL[record.state]}</StateBadge>
        <span
          className="min-w-0 flex-1 truncate text-2xs text-muted-foreground/70"
          title={record.meta}
        >
          {record.meta}
        </span>
      </span>
    </SelectableRow>
  );
};
