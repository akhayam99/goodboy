import { Eyebrow } from '@goodboy/ui';
import { useNow } from '../../../../../shared/hooks/useNow';
import { integrationLabel } from '../../../../../shared/utils/integrationLabel';
import { TASK_PICKER_COPY } from './taskPickerCopy';
import { taskPickerOptionId } from './taskPickerOptionId';
import { TaskPickerRow } from './TaskPickerRow';
import type { TaskPickerItem, TaskPickerView } from './taskPickerView';

type Props = {
  readonly listId: string;
  readonly view: TaskPickerView;
  readonly activeKey: string | null;
  readonly onActivate: (key: string) => void;
  readonly onPick: (item: TaskPickerItem) => void;
};

export const TaskPickerList = ({ listId, view, activeKey, onActivate, onPick }: Props) => {
  const now = useNow(30_000);

  return (
    <div id={listId} role="listbox" aria-label={TASK_PICKER_COPY.list} className="flex flex-col">
      {view.groups.map((group) => (
        <div key={group.provider} role="presentation" className="flex flex-col">
          {view.isGrouped ? (
            <div role="presentation" className="flex items-center gap-2 px-2 pb-1 pt-2">
              <Eyebrow label={integrationLabel({ provider: group.provider })} muted />
              <span className="text-meta tabular-nums text-faint-foreground">
                {group.items.length}
              </span>
            </div>
          ) : null}
          {group.items.map((item) => (
            <TaskPickerRow
              key={item.key}
              item={item}
              optionId={taskPickerOptionId({ listId, key: item.key })}
              isActive={item.key === activeKey}
              now={now}
              onActivate={onActivate}
              onPick={onPick}
            />
          ))}
        </div>
      ))}
    </div>
  );
};
