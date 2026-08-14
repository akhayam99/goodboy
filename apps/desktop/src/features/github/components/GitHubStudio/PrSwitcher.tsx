import type { PullRequestState } from '@goodboy/types';
import { cn, DropdownBackdrop, Popover, ScrollFade, useDropdown } from '@goodboy/ui';
import { Check, ChevronDown } from 'lucide-react';
import { PullRequestChip } from '../PullRequestChip';

type Props = {
  readonly prs: ReadonlyArray<PullRequestState>;
  readonly selected: number | null;
  readonly onSelect: (prNumber: number) => void;
};

export const PrSwitcher = ({ prs, selected, onSelect }: Props) => {
  const { open, close, toggle, containerRef, popupRef, popupClassName } = useDropdown({
    width: 'w-96',
    expectedHeight: 288,
    hasBackdrop: true,
  });
  const current = prs.find((p) => p.number === selected) ?? prs[0];
  if (!current) {
    return null;
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={toggle}
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
          <DropdownBackdrop onClose={close} />
          <Popover innerRef={popupRef} className={popupClassName}>
            <ScrollFade className="max-h-72" viewportClassName="py-1">
              <ul role="listbox">
                {prs.map((p) => (
                  <li key={p.number}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={p.number === selected}
                      onClick={() => {
                        onSelect(p.number);
                        close();
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-muted/50',
                        p.number === selected && 'bg-primary/5',
                      )}
                    >
                      <PullRequestChip state={p.state} variant="icon" iconSize={12} />
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        #{p.number}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-foreground">{p.title}</span>
                      {p.number === selected && (
                        <Check size={12} aria-hidden className="shrink-0 text-primary" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </ScrollFade>
          </Popover>
        </>
      ) : null}
    </div>
  );
};
