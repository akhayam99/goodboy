import { noteIdOfThread } from '../../resolve/notes/noteThread';

const REVIEW_ID_PREFIX = 'review:';

type ThreadParams = {
  readonly threadId: string;
};

type IdParams = {
  readonly id: string;
};

export const hostDiffThreadId = ({ threadId }: ThreadParams): string =>
  `${REVIEW_ID_PREFIX}${threadId}`;

export const hostThreadIdOf = ({ id }: IdParams): string =>
  id.startsWith(REVIEW_ID_PREFIX) ? id.slice(REVIEW_ID_PREFIX.length) : id;

export const diffThreadIdOf = ({ threadId }: ThreadParams): string =>
  noteIdOfThread({ threadId }) ?? hostDiffThreadId({ threadId });
