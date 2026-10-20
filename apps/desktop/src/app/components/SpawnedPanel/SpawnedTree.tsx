import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { SpawnedTreeContext } from './spawnedTreeContext';
import { treeKeyTargetOf } from './treeKeyTargetOf';

type Props = {
  readonly label: string;
  readonly children: ReactNode;
};

const ITEM_SELECTOR = '[role="treeitem"]';

const itemsOf = (root: HTMLElement): ReadonlyArray<HTMLElement> => [
  ...root.querySelectorAll<HTMLElement>(ITEM_SELECTOR),
];

const levelOf = (item: HTMLElement): number => Number(item.getAttribute('aria-level') ?? '1');

export const SpawnedTree = ({ label, children }: Props) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const focus = useMemo(() => ({ activeId, setActiveId }), [activeId]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (root === null) {
      return;
    }
    const items = itemsOf(root);
    const tabbable =
      items.find((item) => item.dataset.treeId === activeId) ?? items[0] ?? undefined;
    for (const item of items) {
      item.tabIndex = item === tabbable ? 0 : -1;
    }
  });

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const root = rootRef.current;
    if (root === null || !(event.target instanceof HTMLElement)) {
      return;
    }
    const current = event.target.closest<HTMLElement>(ITEM_SELECTOR);
    if (current === null) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      current.click();
      return;
    }
    const items = itemsOf(root);
    const next = treeKeyTargetOf({
      key: event.key,
      levels: items.map(levelOf),
      from: items.indexOf(current),
    });
    if (next === null) {
      return;
    }
    event.preventDefault();
    const target = items[next];
    if (target === undefined) {
      return;
    }
    setActiveId(target.dataset.treeId ?? '');
    target.focus();
  };

  return (
    <SpawnedTreeContext.Provider value={focus}>
      <div
        ref={rootRef}
        role="tree"
        aria-label={label}
        data-spawned-tree=""
        onKeyDown={onKeyDown}
        className="flex min-w-0 flex-col"
      >
        {children}
      </div>
    </SpawnedTreeContext.Provider>
  );
};
