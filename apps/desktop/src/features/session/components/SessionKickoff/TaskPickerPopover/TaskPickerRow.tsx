import { memo } from 'react';
import { cn, ICON_SIZE, tintClasses, TruncatedText } from '@goodboy/ui';
import { IntegrationGlyph } from '../../../../../shared/components/IntegrationGlyph';
import { INBOX_STATE_PRESENTATION } from '../../../../../shared/components/StudioDetail/RecordState';
import { formatAge } from '../../../../../shared/utils/time/formatAge';
import { taskKeyOf } from '../../../../inbox/taskKeyOf';
import type { TaskPickerItem } from './taskPickerView';

type Props = {
  readonly item: TaskPickerItem;
  readonly optionId: string;
  readonly isActive: boolean;
  readonly now: number;
  readonly onActivate: (key: string) => void;
  readonly onPick: (item: TaskPickerItem) => void;
};

const TaskPickerRowView = ({ item, optionId, isActive, now, onActivate, onPick }: Props) => {
  const { record } = item;
  const state = INBOX_STATE_PRESENTATION[record.state];
  const StateIcon = state.icon;
  const age = record.updatedAt === '' ? '' : formatAge({ from: record.updatedAt, now });
  const context = record.context.trim();

  return (
    <div
      id={optionId}
      role="option"
      aria-selected={isActive}
      aria-label={`${record.identifier} ${record.title}`}
      data-active={isActive || undefined}
      onMouseMove={() => {
        if (!isActive) {
          onActivate(item.key);
        }
      }}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onPick(item)}
      className={cn(
        'flex w-full min-w-0 shrink-0 cursor-pointer items-start gap-2 rounded-sm px-2 py-1 text-left',
        isActive && 'bg-selected',
      )}
    >
      <span aria-hidden className="flex h-5 shrink-0 items-center">
        <IntegrationGlyph provider={record.provider} size="xs" useBrandColor />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex h-5 min-w-0 items-center gap-2">
          <span className="shrink-0 text-meta tabular-nums text-muted-foreground">
            {taskKeyOf({ record })}
          </span>
          <TruncatedText className="min-w-0 flex-1 truncate text-body text-foreground">
            {record.title}
          </TruncatedText>
          {age === '' ? null : (
            <span className="shrink-0 text-meta tabular-nums text-faint-foreground">{age}</span>
          )}
        </span>
        <span className="flex min-w-0 items-center gap-1 text-meta text-faint-foreground">
          <StateIcon
            size={ICON_SIZE.mark}
            aria-hidden
            className={cn('shrink-0', tintClasses(state.tone).icon)}
          />
          <span className="min-w-0 truncate">
            {context === '' ? record.stateLabel : `${record.stateLabel} · ${context}`}
          </span>
        </span>
      </span>
    </div>
  );
};

export const TaskPickerRow = memo(TaskPickerRowView);
