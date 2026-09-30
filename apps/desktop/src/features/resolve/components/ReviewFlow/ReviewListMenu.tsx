import { Check, ListFilter } from 'lucide-react';
import { OverflowMenu, cn, type OverflowMenuItem } from '@goodboy/ui';
import {
  REVIEW_STATE_FILTERS,
  REVIEW_STATE_FILTER_LABEL,
  type ReviewStateFilter,
} from '../../reviewCommentState';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { REVIEW_FLOW_LABEL } from '../../reviewFlowCopy';

type Props = {
  readonly filter: ReviewStateFilter;
  readonly onFilter: (filter: ReviewStateFilter) => void;
};

export const ReviewListMenu = ({ filter, onFilter }: Props) => {
  const items: ReadonlyArray<OverflowMenuItem> = [
    { kind: 'header', key: 'show', label: 'Show' },
    ...REVIEW_STATE_FILTERS.map((option): OverflowMenuItem => ({
      kind: 'item',
      key: option,
      label: REVIEW_STATE_FILTER_LABEL[option],
      icon: option === filter ? Check : undefined,
      onClick: () => onFilter(option),
    })),
  ];
  return (
    <div className="flex items-center justify-end gap-1.5 px-1 pb-1">
      {filter !== 'all' && (
        <span className="text-secondary text-muted-foreground">
          {REVIEW_STATE_FILTER_LABEL[filter]}
        </span>
      )}
      <OverflowMenu
        items={items}
        label={REVIEW_FLOW_LABEL.listMenu}
        trigger={<ListFilter size={ICON_SIZE.control} aria-hidden />}
        triggerClassName={cn(filter !== 'all' && 'text-foreground')}
      />
    </div>
  );
};
