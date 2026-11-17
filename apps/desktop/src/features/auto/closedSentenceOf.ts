import type { AutoClosedMark } from './delegationClosedOf';

const CLOSED_WORD = {
  done: 'Closed by the Lead',
  skipped: 'Skipped by the Lead',
  discarded: 'Discarded by the Lead',
} as const satisfies Readonly<Record<AutoClosedMark['as'], string>>;

type Params = {
  readonly mark: AutoClosedMark;
};

export const closedSentenceOf = ({ mark }: Params): string =>
  mark.reason === '' ? CLOSED_WORD[mark.as] : `${CLOSED_WORD[mark.as]}: ${mark.reason}`;
