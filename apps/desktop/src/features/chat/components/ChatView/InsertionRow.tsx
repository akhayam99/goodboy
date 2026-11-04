import type { TranscriptInsertion } from '../../../../shared/types/transcriptInsertion';

type Props = {
  readonly insertion: TranscriptInsertion;
};

export const InsertionRow = ({ insertion }: Props) => <li>{insertion.node}</li>;
