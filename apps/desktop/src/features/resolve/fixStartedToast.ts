const FIX_STARTED_TITLE = 'Fix run started';

const FIX_QUEUED_TITLE = 'Fix queued after the current fix';

const FIX_NEW_MODEL_TITLE = 'New fix run on the model you picked';

type FixStartKeyParams = {
  readonly batchId: string;
};

export const fixStartKeyOf = ({ batchId }: FixStartKeyParams): string => `batch:${batchId}`;

type FixStartedTitleParams = {
  readonly isQueued: boolean;
  readonly isModelChange?: boolean;
};

type FixStartedMessageParams = {
  readonly count: number;
  readonly noun: 'comment' | 'note';
  readonly where: string | null;
};

type FixStartedWhereParams = {
  readonly repo: string | null;
  readonly prNumber: number | null;
};

export const fixStartedTitleOf = ({
  isQueued,
  isModelChange = false,
}: FixStartedTitleParams): string => {
  if (isQueued) {
    return FIX_QUEUED_TITLE;
  }
  return isModelChange ? FIX_NEW_MODEL_TITLE : FIX_STARTED_TITLE;
};

export const fixStartedMessageOf = ({ count, noun, where }: FixStartedMessageParams): string => {
  const counted = `${count} ${noun}${count === 1 ? '' : 's'}`;
  return where === null ? counted : `${counted} on ${where}`;
};

export const fixStartedWhereOf = ({ repo, prNumber }: FixStartedWhereParams): string | null => {
  const name = repo?.split('/').at(-1) ?? null;
  if (name !== null && name !== '') {
    return name;
  }
  return prNumber === null ? null : `#${prNumber}`;
};
