import { useState } from 'react';
import type { PullRequestState } from '@goodboy/types';
import { cn } from '@goodboy/ui';
import { Check, ChevronDown } from 'lucide-react';
import { PullRequestChip } from '../PullRequestChip';

type Props = {
  readonly prs: ReadonlyArray<PullRequestState>;
  readonly selected: number | null;
  readonly onSelect: (prNumber: number) => void;
};

export const PrSwitcher = ({ prs, selected, onSelect }: Props) => {
  const [open, setOpen] = useState(false);
  const current = prs.find((p) => p.number === selected) ?? prs[0];
  if (!current) return null;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-md border border-border-soft px-2 py-1 text-xs font-medium text-foreground transition-colors hover:border-border hover:bg-muted/50"
        aria-haspopup="listbox"
        aria-expanded={open}
        title={`${prs.length} pull requests on this branch`}
      >
        <PullRequestChip state={current.state} variant="icon" iconSize={12} />
        <span className="tabular-nums">#{current.number}</span>
        <span className="text-2xs text-muted-foreground">of {prs.length}</span>
        <ChevronDown size={12} aria-hidden className="text-muted-foreground" />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <ul
            role="listbox"
            className="absolute left-0 z-50 mt-1 max-h-72 w-96 overflow-y-auto rounded-md border border-border-soft bg-background py-1 shadow-lg"
          >
            {prs.map((p) => (
              <li key={p.number}>
                <button
                  type="button"
                  role="option"
                  aria-selected={p.number === selected}
                  onClick={() => {
                    onSelect(p.number);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-muted/50',
                    p.number === selected && 'bg-primary/5',
                  )}
                >
                  <PullRequestChip state={p.state} variant="icon" iconSize={12} />
                  <span className="shrink-0 tabular-nums text-muted-foreground">#{p.number}</span>
                  <span className="min-w-0 flex-1 truncate text-foreground">{p.title}</span>
                  {p.number === selected ? (
                    <Check size={12} aria-hidden className="shrink-0 text-primary" />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
};
