import type { PullRequestEntry } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { ArrowUpRight } from 'lucide-react';
import { cn, formatUsd, formatUsdPrecise } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { DeletedSessionTag } from '../../../../shared/components/DeletedSessionTag';

type Props = {
  readonly entry: PullRequestEntry;
  readonly onOpenSession: (sessionId: SessionId) => void;
};

const ROW = 'flex items-center gap-2 rounded-md px-2 py-2 text-left text-label';

export const PullRequestRow = ({ entry, onOpenSession }: Props) => {
  const content = (
    <>
      <CONCEPT_ICONS.pr size={ICON_SIZE.row} aria-hidden className="shrink-0 text-success" />
      <span className="min-w-0 flex-1 truncate">
        #{entry.number} {entry.title}
      </span>
      {entry.isDeleted ? <DeletedSessionTag /> : null}
      {entry.spendUsd === null ? null : (
        <span
          title={formatUsdPrecise(entry.spendUsd)}
          className="shrink-0 font-mono tabular-nums text-muted-foreground"
        >
          {formatUsd(entry.spendUsd)}
        </span>
      )}
      <span className="shrink-0 capitalize text-muted-foreground">{entry.state}</span>
    </>
  );
  if (entry.isDeleted) {
    return <div className={ROW}>{content}</div>;
  }
  return (
    <button
      type="button"
      onClick={() => onOpenSession(entry.sessionId)}
      className={cn(ROW, 'hover:bg-hover')}
    >
      {content}
      <ArrowUpRight size={ICON_SIZE.row} aria-hidden />
    </button>
  );
};
