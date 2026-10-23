import { AnchoredPopover, Button, cn, useDropdown, type MenuEntry } from '@goodboy/ui';
import { AppMenuList } from '../../../actions/AppMenuList';
import { TASK_GROUP_BYS, TASK_GROUP_BY_LABEL, type TaskGroupBy } from '../../taskGroups';

type Props = {
  readonly groupBy: TaskGroupBy;
  readonly onGroupBy: (groupBy: TaskGroupBy) => void;
};

export const TasksGroupByMenu = ({ groupBy, onGroupBy }: Props) => {
  const dropdown = useDropdown({ width: 'min-w-50', expectedHeight: 160 });
  const entries: ReadonlyArray<MenuEntry> = [
    {
      kind: 'radio',
      key: 'group-by',
      label: 'Group by',
      choices: TASK_GROUP_BYS.map((value) => ({
        id: value,
        label: TASK_GROUP_BY_LABEL[value],
        isCurrent: value === groupBy,
      })),
      onSelect: (choice) => {
        const next = TASK_GROUP_BYS.find((value) => value === choice);
        if (next === undefined) {
          return;
        }
        onGroupBy(next);
      },
    },
  ];
  return (
    <AnchoredPopover
      dropdown={dropdown}
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
      <AppMenuList label="Group tasks by" entries={entries} onClose={dropdown.close} />
    </AnchoredPopover>
  );
};
