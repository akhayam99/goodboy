import { ChevronDown, ChevronUp } from '@goodboy/ui/icons';
import { ICON_SIZE, ListGridRow, TEXT_ROLE } from '@goodboy/ui';

type Props = {
  readonly isExpanded: boolean;
  readonly onClick: () => void;
};

export const TaskGroupFoot = ({ isExpanded, onClick }: Props) => {
  const Icon = isExpanded ? ChevronUp : ChevronDown;
  return (
    <ListGridRow
      rowKey={isExpanded ? 'show-fewer' : 'show-all'}
      onSelect={onClick}
      cells={{
        byKey: {
          source: <Icon size={ICON_SIZE.row} aria-hidden className={TEXT_ROLE.hint} />,
          title: (
            <span data-task-group-foot="" className={TEXT_ROLE.secondary}>
              {isExpanded ? 'Show fewer' : 'Show all'}
            </span>
          ),
        },
      }}
    />
  );
};
