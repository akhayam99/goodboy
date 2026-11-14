import { branchWorkTabRegistration } from '../../branchWorkTabRegistration';
import { BoardAlsoWaiting } from './BoardAlsoWaiting';
import { BoardDoors } from './BoardDoors';
import { useBoardContext } from './useBoardContext';

type Props = {
  readonly rowId: string;
};

export const BoardOpenRow = ({ rowId }: Props) => {
  const { session, entryByRowId } = useBoardContext();
  const entry = entryByRowId.get(rowId) ?? null;
  const work = branchWorkTabRegistration.useWork({
    session,
    mountId: entry === null ? null : entry.fact.mountId,
    mountPath: entry === null ? null : entry.fact.mountPath,
  });
  return (
    <div
      data-slot="branch-work"
      data-board-open={rowId}
      className="col-span-full flex min-w-0 flex-col gap-4 rounded-md bg-background px-4 py-4"
    >
      {branchWorkTabRegistration.render({ session, work })}
      <BoardAlsoWaiting rowId={rowId} />
      <BoardDoors rowId={rowId} counts={work.counts} />
    </div>
  );
};
