import { Minus, Pencil, Plus, type LucideIcon } from 'lucide-react';
import { ROW_INTERACTIVE, cn } from '@goodboy/ui';
import type { SessionDecision } from '@goodboy/types';
import type { DecisionChangesSince } from '../../../../store/slices/contextDrawer/decisionChangesSince';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ContextBlock } from './ContextBlock';

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
    <ContextBlock title="Changed since you last looked" count={rows.length}>
      <ul className="-mx-2 flex flex-col">
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
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left',
                  ROW_INTERACTIVE,
                )}
              >
                <Icon size={ICON_SIZE.row} aria-hidden className={cn('shrink-0', mark.className)} />
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
                <span className="shrink-0 text-meta text-faint-foreground">{verb}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </ContextBlock>
  );
};
