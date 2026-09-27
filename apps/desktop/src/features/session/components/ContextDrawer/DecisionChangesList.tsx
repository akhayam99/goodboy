import { Minus, Pencil, Plus, type LucideIcon } from 'lucide-react';
import { SectionHeader, cn } from '@goodboy/ui';
import type { SessionDecision } from '@goodboy/types';
import type { DecisionChangesSince } from '../../../../store/slices/contextDrawer/decisionChangesSince';

type ChangeKind = 'added' | 'removed' | 'reworded';

type ChangeRow = {
  readonly kind: ChangeKind;
  readonly decision: SessionDecision;
};

const MARK: Readonly<
  Record<ChangeKind, { readonly icon: LucideIcon; readonly className: string }>
> = {
  added: { icon: Plus, className: 'text-success' },
  removed: { icon: Minus, className: 'text-danger' },
  reworded: { icon: Pencil, className: 'text-info' },
};

const verbOf = ({ kind, decision }: ChangeRow): string => {
  if (kind === 'added') {
    return 'Added';
  }
  if (kind === 'reworded') {
    return 'Reworded';
  }
  if (decision.status === 'withdrawn' || decision.replacedBy === null) {
    return 'Withdrawn';
  }
  return `Replaced by ${decision.replacedBy}`;
};

type Props = {
  readonly changes: DecisionChangesSince;
  readonly onJump: (number: number) => void;
};

export const DecisionChangesList = ({ changes, onJump }: Props) => {
  const rows: ReadonlyArray<ChangeRow> = [
    ...changes.added.map((decision) => ({ kind: 'added' as const, decision })),
    ...changes.removed.map((decision) => ({ kind: 'removed' as const, decision })),
    ...changes.reworded.map((decision) => ({ kind: 'reworded' as const, decision })),
  ];

  return (
    <section aria-label="Changed since you last looked" className="flex flex-col gap-1.5">
      <SectionHeader
        label="Changed since you last looked"
        headingLevel={3}
        meta={
          <span className="text-secondary tabular-nums text-faint-foreground">{rows.length}</span>
        }
      />
      <ul className="flex flex-col">
        {rows.map((row) => {
          const mark = MARK[row.kind];
          const Icon = mark.icon;
          const verb = verbOf(row);
          return (
            <li key={`${row.kind}-${row.decision.id}`}>
              <button
                type="button"
                data-change={row.kind}
                aria-label={`${verb}: decision ${row.decision.number}`}
                onClick={() => onJump(row.decision.number)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <Icon size={12} aria-hidden className={cn('shrink-0', mark.className)} />
                <span className="shrink-0 text-meta tabular-nums text-muted-foreground">
                  {row.decision.number}
                </span>
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-label',
                    row.kind === 'removed'
                      ? 'text-faint-foreground line-through'
                      : 'text-foreground',
                  )}
                >
                  {row.decision.text}
                </span>
                <span className="shrink-0 text-secondary text-faint-foreground">{verb}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
