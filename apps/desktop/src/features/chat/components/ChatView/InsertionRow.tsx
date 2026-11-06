import type { PlacedInsertion } from './placedRowsOf';

type Props = {
  readonly insertion: PlacedInsertion;
};

export const InsertionRow = ({ insertion }: Props) =>
  insertion.node === null ? null : (
    <li>
      {typeof insertion.node === 'function'
        ? insertion.node({ replies: insertion.replies })
        : insertion.node}
    </li>
  );
