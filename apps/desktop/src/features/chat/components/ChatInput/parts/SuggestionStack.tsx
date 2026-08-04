import { useState, type ReactNode } from 'react';

export function SuggestionStack({
  items,
}: {
  items: ReadonlyArray<{ readonly key: string; readonly node: ReactNode }>;
}) {
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) {
    return null;
  }
  const [top, ...rest] = items;
  if (!top) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {top.node}
      {expanded ? rest.map((it) => <div key={it.key}>{it.node}</div>) : null}
      {rest.length > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="self-start rounded-md px-1.5 py-0.5 text-2xs font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          {expanded
            ? 'show fewer suggestions'
            : `+${rest.length} more suggestion${rest.length === 1 ? '' : 's'}`}
        </button>
      )}
    </div>
  );
}
