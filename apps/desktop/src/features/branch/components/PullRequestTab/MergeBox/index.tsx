import type { MergeBox as MergeBoxModel, MergeBoxTarget } from './mergeBox';
import { MergeBoxPassing } from './MergeBoxPassing';
import { MergeBoxRow } from './MergeBoxRow';
import { MergeBoxSkeleton } from './MergeBoxSkeleton';
import { MergeBoxVerdict } from './MergeBoxVerdict';

type Props = {
  readonly box: MergeBoxModel | null;
  readonly onOpen: (target: MergeBoxTarget) => void;
};

const FRAME = 'flex min-w-0 flex-col gap-1 rounded-lg border border-border-soft bg-subtle p-1';

export const MergeBox = ({ box, onOpen }: Props) => {
  if (box === null) {
    return (
      <section
        aria-label="Merge status"
        aria-busy="true"
        data-merge-box=""
        data-pending=""
        className={FRAME}
      >
        <MergeBoxSkeleton />
      </section>
    );
  }
  return (
    <section aria-label="Merge status" data-merge-box="" className={FRAME}>
      <MergeBoxVerdict verdict={box.verdict} />
      {box.rows.length === 0 ? null : (
        <ul aria-label="What holds the merge" className="flex min-w-0 flex-col">
          {box.rows.map((row) => (
            <li key={row.id} className="flex min-w-0">
              <MergeBoxRow row={row} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      )}
      <MergeBoxPassing passing={box.passing} />
    </section>
  );
};
