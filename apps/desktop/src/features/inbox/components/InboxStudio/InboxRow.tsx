import { memo } from 'react';
import { cn, ICON_SIZE, ListGridRow, StatusDot, tintClasses } from '@goodboy/ui';
import { IntegrationGlyph } from '../../../integrations/components/IntegrationGlyph';
import { integrationLabel } from '../../../../shared/utils/integrationLabel';

import { INBOX_STATE_PRESENTATION } from '../../../../shared/components/StudioDetail/RecordState';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { recordSessionId } from '../../recordSessionId';
import { startLabelOf } from '../../startFromRecord';
import type { InboxRecord } from '../../types';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import { useNow } from '../../../../shared/hooks/useNow';
import { TaskPriorityMark } from './TaskPriorityMark';
import { taskKeyOf } from '../../taskKeyOf';

type Props = {
  readonly record: InboxRecord;
  readonly selected: boolean;
  readonly isCursor?: boolean;
  readonly isNew?: boolean;
  readonly onSelect: (record: InboxRecord) => void;
  readonly isStarred?: boolean;
  readonly onToggleStar?: (record: InboxRecord) => void;
  readonly onActivate?: (record: InboxRecord) => void;
};

type OptionIdParams = {
  readonly key: string;
};

export const inboxOptionId = ({ key }: OptionIdParams): string =>
  `inbox-option-${key.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

const InboxRowView = ({
  record,
  selected,
  isCursor = false,
  isNew = false,
  onSelect,
  isStarred,
  onToggleStar,
  onActivate,
}: Props) => {
  const now = useNow(30_000);
  const sessionId = recordSessionId({ record });
  const toolLabel = integrationLabel({ provider: record.provider });
  const state = INBOX_STATE_PRESENTATION[record.state];
  const StateIcon = state.icon;
  const menu = useObjectMenuTrigger({
    target: {
      kind: 'record',
      facts: {
        identifier: record.identifier,
        title: record.title,
        url: record.url,
        providerLabel: toolLabel,
        sessionId,
        isStarred: isStarred ?? null,
        onOpen: () => onSelect(record),
        launchLabel: startLabelOf({ record }),
        onLaunch: onActivate === undefined ? null : () => onActivate(record),
        onToggleStar:
          isStarred === undefined || onToggleStar === undefined ? null : () => onToggleStar(record),
        onRefresh: null,
        verbs: [],
        sessionVerbs: [],
        destructive: [],
      },
    },
    anchorKey: `inbox:${record.key}`,
  });

  return (
    <ListGridRow
      isOption
      optionId={inboxOptionId({ key: record.key })}
      rowKey={record.key}
      isSelected={selected}
      isCursor={isCursor}
      ariaLabel={`${record.identifier} ${record.title}`}
      tooltip={record.title}
      onSelect={() => onSelect(record)}
      onContextMenu={menu.onContextMenu}
      onKeyDown={menu.onKeyDown}
      cells={[
        <IntegrationGlyph key="source" provider={record.provider} size="xs" useBrandColor />,
        <span key="key" className="truncate font-mono">
          {taskKeyOf({ record })}
        </span>,
        <span
          key="title"
          className={cn(
            'flex min-w-0 items-center gap-2',
            record.state === 'done' && 'text-muted-foreground',
          )}
        >
          {isNew ? (
            <span data-task-new="" role="img" aria-label="New" className="flex shrink-0">
              <StatusDot tone="primary" size="sm" />
            </span>
          ) : null}
          <span className="truncate">{record.title}</span>
        </span>,
        record.provider === 'slack' ? null : (
          <StateIcon
            key="status"
            size={ICON_SIZE.row}
            aria-label={record.stateLabel}
            className={tintClasses(state.tone).icon}
          />
        ),
        <TaskPriorityMark key="priority" record={record} />,
        formatAge({ from: record.updatedAt, now }),
      ]}
    />
  );
};

export const InboxRow = memo(InboxRowView);
