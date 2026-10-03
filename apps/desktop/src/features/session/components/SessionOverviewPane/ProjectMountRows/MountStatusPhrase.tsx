import { Skeleton, Tooltip, cn } from '@goodboy/ui';
import type { WorktreeStatus } from '@goodboy/types';
import type { MountRowView } from '../../../../../store/slices/project-mounts/mountRowModel';
import { branchPresenceOf, mainPresenceOf } from '../../../../../shared/lib/branchPresence';
import { mountOperationView } from './mountRowState';

type Props = {
  readonly label: string;
  readonly status: WorktreeStatus | null;
  readonly series: MountRowView['series'];
  readonly isRepo: boolean;
  readonly isPending: boolean;
  readonly isSkeleton: boolean;
  readonly isMerged: boolean;
  readonly isRebasing: boolean;
  readonly commitsAfterMerge: number | null;
};

type PhraseParams = Pick<Props, 'status' | 'isMerged' | 'commitsAfterMerge'>;

type Phrase = {
  readonly text: string;
  readonly isWarning: boolean;
  readonly detail: string;
};

const phraseOf = ({ status, isMerged, commitsAfterMerge }: PhraseParams): Phrase | null => {
  if (status === null) {
    return null;
  }
  const presence = branchPresenceOf({ status, isMerged, commitsAfterMerge });
  const isWarning = presence.kind === 'gone-on-origin' || presence.kind === 'diverged';
  if (presence.kind === 'on-origin') {
    return {
      text: presence.toPush === null ? 'Up to date' : `${presence.toPush} to push`,
      isWarning,
      detail: presence.label,
    };
  }
  return { text: presence.label, isWarning, detail: presence.label };
};

type DetailParams = Pick<Props, 'status' | 'series' | 'isRebasing'> & {
  readonly phrase: Phrase | null;
};

const detailsOf = ({ status, series, isRebasing, phrase }: DetailParams): string => {
  const details: Array<string> = [];
  if (phrase !== null) {
    details.push(phrase.detail);
  }
  if (status !== null) {
    const main = mainPresenceOf({ status, isRebasingAgent: isRebasing });
    if (main.kind === 'behind-main' || main.kind === 'rebasing-on-main') {
      details.push(main.label);
    }
  }
  if (series !== null) {
    details.push(`Part ${series.label} of ${series.name}`);
  }
  return details.join(' · ');
};

export const MountStatusPhrase = ({
  label,
  status,
  series,
  isRepo,
  isPending,
  isSkeleton,
  isMerged,
  isRebasing,
  commitsAfterMerge,
}: Props) => {
  if (!isRepo) {
    return null;
  }
  if (isSkeleton || (isPending && status === null)) {
    return (
      <span data-testid="mount-status-skeleton" className="shrink-0">
        <Skeleton className="h-3 w-14" />
      </span>
    );
  }
  const operation = mountOperationView({ status, label });
  const phrase = phraseOf({ status, isMerged, commitsAfterMerge });
  const details = detailsOf({ status, series, isRebasing, phrase });
  const text = operation?.label ?? phrase?.text ?? null;
  if (text === null) {
    return null;
  }
  const isWarning = operation !== null || phrase?.isWarning === true;
  const node = (
    <span
      title={operation?.title}
      className={cn(
        'shrink-0 whitespace-nowrap text-secondary',
        isWarning ? 'text-warning' : 'text-muted-foreground',
      )}
    >
      {text}
    </span>
  );
  if (details === '' || details === text) {
    return node;
  }
  return <Tooltip content={details}>{node}</Tooltip>;
};
