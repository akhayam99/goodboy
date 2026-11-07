const ITEM_SELECTOR = '[role="treeitem"]';

type Params = {
  readonly element: HTMLElement;
};

export const spawnedTreeItemsOf = ({ element }: Params): ReadonlyArray<HTMLElement> => [
  ...element.querySelectorAll<HTMLElement>(ITEM_SELECTOR),
];
