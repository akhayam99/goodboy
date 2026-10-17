import { Check } from 'lucide-react';
import { AnchoredPopover, Button, ROW_INTERACTIVE, cn, useDropdown } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { TASK_GROUP_BYS, TASK_GROUP_BY_LABEL, type TaskGroupBy } from '../../taskGroups';

type Props = {
  readonly groupBy: TaskGroupBy;
  readonly onGroupBy: (groupBy: TaskGroupBy) => void;
};

export const TasksGroupByMenu = ({ groupBy, onGroupBy }: Props) => {
  const dropdown = useDropdown({ width: 'min-w-50', expectedHeight: 140 });
  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="menu"
      ariaLabel="Group tasks by"
      className="py-1"
      trigger={
        <Button
          variant="secondary"
          size="sm"
          aria-haspopup="menu"
          aria-expanded={dropdown.open}
          onClick={dropdown.toggle}
          className={cn(dropdown.open && 'bg-selected')}
        >
          {`Group: ${TASK_GROUP_BY_LABEL[groupBy]}`}
        </Button>
      }
    >
      {TASK_GROUP_BYS.map((value) => (
        <button
          key={value}
          type="button"
          role="menuitemradio"
          aria-checked={value === groupBy}
          onClick={() => {
            onGroupBy(value);
            dropdown.close();
          }}
          className={cn(
            'flex w-full items-center justify-between gap-3 px-3 py-1 text-left text-label',
            ROW_INTERACTIVE,
          )}
        >
          {TASK_GROUP_BY_LABEL[value]}
          {value === groupBy ? <Check size={ICON_SIZE.row} aria-hidden /> : null}
        </button>
      ))}
    </AnchoredPopover>
  );
};
