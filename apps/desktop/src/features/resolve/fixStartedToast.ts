const FIX_STARTED_TITLE = 'Fix run started';

const FIX_QUEUED_TITLE = 'Fix queued after the current fix';

export const fixStartKeyOf = ({ batchId }: { readonly batchId: string }): string =>
  `batch:${batchId}`;

export const fixStartedTitleOf = ({ isQueued }: { readonly isQueued: boolean }): string =>
  isQueued ? FIX_QUEUED_TITLE : FIX_STARTED_TITLE;

export const fixStartedMessageOf = ({
  count,
  noun,
  where,
}: {
  readonly count: number;
  readonly noun: 'comment' | 'note';
  readonly where: string | null;
}): string => {
  const counted = `${count} ${noun}${count === 1 ? '' : 's'}`;
  return where === null ? counted : `${counted} on ${where}`;
};

export const fixStartedWhereOf = ({
  repo,
  prNumber,
}: {
  readonly repo: string | null;
  readonly prNumber: number | null;
}): string | null => {
  const name = repo?.split('/').at(-1) ?? null;
  if (name !== null && name !== '') {
    return name;
  }
  return prNumber === null ? null : `#${prNumber}`;
};
