import type { LeadTreeItem } from './leadTreeItemsOf';

type Params = {
  readonly items: ReadonlyArray<LeadTreeItem>;
};

export const leadAgentCountOf = ({ items }: Params): number =>
  items.reduce((count, item) => {
    if (item.kind === 'agent') {
      return count + 1;
    }
    if (item.kind === 'fold' && !item.isOpen) {
      return count + item.count;
    }
    return count;
  }, 0);
