const ITEM_SELECTOR = '[role="treeitem"]';
const LAUNCH_SELECTOR = '[data-spawned-launch]';

type Params = {
  readonly element: HTMLElement;
};

export const spawnedTreeItemsOf = ({ element }: Params): ReadonlyArray<HTMLElement> => {
  const launches = [...element.querySelectorAll<HTMLElement>(LAUNCH_SELECTOR)];
  if (launches.length === 0) {
    return [...element.querySelectorAll<HTMLElement>(ITEM_SELECTOR)];
  }
  return launches.flatMap((launch) =>
    [...launch.querySelectorAll<HTMLElement>(ITEM_SELECTOR)].reverse(),
  );
};
