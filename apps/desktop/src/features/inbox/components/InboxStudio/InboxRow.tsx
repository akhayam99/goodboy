import { SelectableRow, StatusDot, type Tone } from '@goodboy/ui';
import { IntegrationGlyph } from '../../../integrations/components/IntegrationGlyph';
import { formatRelativeAge } from '../../../../shared/utils/relativeDate';
import type { InboxRecord, InboxState } from '../../types';

const STATE_TONE: Record<InboxState, Tone> = {
  open: 'info',
  active: 'warning',
  done: 'neutral',
  alert: 'danger',
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

export const InboxRow = ({ record, selected, onSelect }: Props) => {
  const relativeTime = formatRelativeAge({ fromIso: record.updatedAt });

  return (
    <SelectableRow
      selected={selected}
      onClick={() => onSelect(record)}
      title={record.title}
      ariaCurrent={selected}
      className="flex-col items-stretch gap-1 px-2.5 py-2"
    >
      <span className="flex items-center gap-2">
        <IntegrationGlyph provider={record.provider} size="xs" useBrandColor />
        <span className="shrink-0 font-mono text-2xs tabular-nums text-muted-foreground">
          {record.identifier}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs">{record.title}</span>
        {relativeTime !== '' ? (
          <span className="shrink-0 text-2xs tabular-nums text-muted-foreground/50">
            {relativeTime}
          </span>
        ) : null}
      </span>
      <span className="flex items-center gap-1.5 pl-6">
        <StatusDot
          tone={STATE_TONE[record.state]}
          size="sm"
          ariaLabel={STATE_LABEL[record.state]}
        />
        <span className="min-w-0 flex-1 truncate text-2xs text-muted-foreground/70">
          {record.meta}
        </span>
      </span>
    </SelectableRow>
  );
};
