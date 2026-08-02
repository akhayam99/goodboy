import { useEffect, useRef, useState } from 'react';
import { EmptyState, ScrollFade } from '@goodboy/ui';
import { AgentAvatar } from '../../../shared/components/AgentAvatar';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';
import type { QuickActionItem } from '../types';

type Props = {
  readonly items: ReadonlyArray<QuickActionItem>;
  readonly emptyHint: string;
  readonly onSelect: (item: QuickActionItem) => void;
  readonly onDismiss: () => void;
};

export const QuickActionsPopover = ({ items, emptyHint, onSelect, onDismiss }: Props) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    setActiveIndex(0);
  }, [items]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, items.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const item = items[activeIndex];
        if (item) {
          onSelect(item);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [items, activeIndex, onSelect, onDismiss]);

  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  return (
    <div className="absolute bottom-full left-0 right-0 z-50 mb-1 overflow-hidden rounded-md border border-border bg-subtle shadow-md">
      {items.length === 0 ? (
        <EmptyState
          icon={CONCEPT_ICONS.search}
          tone={CONCEPT_TONE.search}
          title={emptyHint}
          size="inline"
          className="px-3 py-2"
        />
      ) : (
        <ScrollFade className="max-h-48" viewportClassName="py-1">
          <ul ref={listRef}>
            {items.map((item, i) => (
              <li
                key={item.id}
                className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${
                  i === activeIndex ? 'bg-muted' : 'hover:bg-muted/50'
                }`}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(item);
                }}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-xs font-medium text-foreground">{item.label}</span>
                  {item.sublabel ? (
                    <span className="truncate text-2xs text-muted-foreground">{item.sublabel}</span>
                  ) : null}
                </div>
                {item.trailing ? (
                  <span className="flex shrink-0 items-center gap-1.5 text-2xs uppercase tracking-wide text-muted-foreground">
                    <span>{item.trailing.label}</span>
                    {item.trailing.kind ? (
                      <AgentAvatar kind={item.trailing.kind} size="sm" />
                    ) : null}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </ScrollFade>
      )}
    </div>
  );
};
