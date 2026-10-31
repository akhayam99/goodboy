import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { hopTargetOf } from './hopTargetOf';
import { SpawnedNowRow } from './SpawnedNowRow';
import { SpawnedTreeContext } from './spawnedTreeContext';
import { spawnedTreeItemsOf } from './spawnedTreeItemsOf';
import { treeKeyTargetOf, type TreeOrder } from './treeKeyTargetOf';
import { useSpawnedScrollHold } from './useSpawnedScrollHold';

type Props = {
  readonly label: string;
  readonly hasNow?: boolean;
  readonly order?: TreeOrder;
  readonly children: ReactNode;
};

const ITEM_SELECTOR = '[role="treeitem"]';

const HOP_KEYS: Readonly<Partial<Record<string, 'next' | 'previous'>>> = {
  j: 'next',
  k: 'previous',
};

type ElementParams = {
  readonly element: HTMLElement;
};

const levelOf = ({ element }: ElementParams): number =>
  Number(element.getAttribute('aria-level') ?? '1');

export const SpawnedTree = ({
  label,
  hasNow = true,
  order = 'children-first',
  children,
}: Props) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const focus = useMemo(() => ({ activeId, setActiveId }), [activeId]);
  useSpawnedScrollHold({ rootRef });

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (root === null) {
      return;
    }
    const items = spawnedTreeItemsOf({ element: root });
    const tabbable =
      items.find((item) => item.dataset.treeId === activeId) ??
      items.find((item) => levelOf({ element: item }) === 1) ??
      items[0];
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
    const items = spawnedTreeItemsOf({ element: root });
    const direction = HOP_KEYS[event.key];
    if (direction !== undefined) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }
      const agentItems = items.filter((item) => item.dataset.agentId !== undefined);
      const selected = agentItems.find((item) => item.getAttribute('aria-selected') === 'true');
      const targetId = hopTargetOf({
        ids: agentItems.map((item) => item.dataset.agentId ?? ''),
        current: selected?.dataset.agentId ?? null,
        direction,
      });
      event.preventDefault();
      const hopTarget = agentItems.find((item) => item.dataset.agentId === targetId);
      if (hopTarget === undefined) {
        return;
      }
      hopTarget.click();
      setActiveId(hopTarget.dataset.treeId ?? '');
      hopTarget.focus();
      return;
    }
    const next = treeKeyTargetOf({
      key: event.key,
      levels: items.map((element) => levelOf({ element })),
      from: items.indexOf(current),
      order,
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
        {hasNow ? <SpawnedNowRow /> : null}
        {children}
      </div>
    </SpawnedTreeContext.Provider>
  );
};
