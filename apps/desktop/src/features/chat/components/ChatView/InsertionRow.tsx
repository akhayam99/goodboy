import type {
  InsertionReply,
  TranscriptInsertion,
} from '../../../../shared/types/transcriptInsertion';

type Props = {
  readonly insertion: TranscriptInsertion;
  readonly replies: ReadonlyArray<InsertionReply>;
};

export const InsertionRow = ({ insertion, replies }: Props) => (
  <li>{typeof insertion.node === 'function' ? insertion.node({ replies }) : insertion.node}</li>
);
