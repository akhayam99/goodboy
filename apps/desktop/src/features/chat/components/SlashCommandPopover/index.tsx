import { useEffect, useRef, useState } from 'react';

interface SkillItem {
  readonly name: string;
  readonly description: string;
}

interface SlashCommandPopoverProps {
  readonly items: ReadonlyArray<SkillItem>;
  readonly query: string;
  readonly onSelect: (name: string) => void;
  readonly onDismiss: () => void;
}

function fuzzyMatch(name: string, query: string): boolean {
  return name.toLowerCase().includes(query.toLowerCase());
}

export function SlashCommandPopover({
  items,
  query,
  onSelect,
  onDismiss,
}: SlashCommandPopoverProps) {
  const filtered = items.filter((item) => fuzzyMatch(item.name, query));
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const item = filtered[activeIndex];
        if (item) onSelect(item.name);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [filtered, activeIndex, onSelect, onDismiss]);

  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  return (
    <div className="absolute bottom-full left-0 right-0 z-50 mb-1 overflow-hidden rounded-md border border-border bg-subtle shadow-md">
      {filtered.length === 0 ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">no skills. create one in settings</p>
      ) : (
        <ul ref={listRef} className="max-h-48 overflow-y-auto py-1">
          {filtered.map((item, i) => (
            <li
              key={item.name}
              className={`flex cursor-pointer flex-col gap-0.5 px-3 py-2 ${
                i === activeIndex ? 'bg-accent' : 'hover:bg-accent/50'
              }`}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(item.name);
              }}
            >
              <span className="text-xs font-medium text-foreground">/{item.name}</span>
              {item.description ? (
                <span className="text-xs text-muted-foreground">{item.description}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
