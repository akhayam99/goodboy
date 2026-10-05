import { countRowIdOf, type TimelineRowItem } from '../../../../timeline/buildTimelineStream';
import type { TimelineBranchKey } from './TimelineStreamRow';

type Params = {
  readonly item: TimelineRowItem;
  readonly isBranchExpanded: boolean;
  readonly onSet: (params: { readonly id: string; readonly isExpanded: boolean }) => void;
};

export const timelineBranchKey = ({
  item,
  isBranchExpanded,
  onSet,
}: Params): TimelineBranchKey | null => {
  const { branches, explode } = item;
  if (branches === undefined && explode === undefined) {
    return null;
  }
  return ({ direction }) => {
    if (branches !== undefined) {
      const isExpanding = direction === 'expand' && !isBranchExpanded;
      const isCollapsing = direction === 'collapse' && isBranchExpanded;
      if (isExpanding || isCollapsing) {
        branches.forEach((branch) => onSet({ id: branch.expandId, isExpanded: isExpanding }));
        return true;
      }
    }
    if (direction !== 'collapse' || explode === undefined) {
      return false;
    }
    document
      .querySelector<HTMLElement>(
        `[data-row-id="${countRowIdOf({ expandId: explode.groupId })}"] button`,
      )
      ?.focus();
    onSet({ id: explode.groupId, isExpanded: false });
    return true;
  };
};
