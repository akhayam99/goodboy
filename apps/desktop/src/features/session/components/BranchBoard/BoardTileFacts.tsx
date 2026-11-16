import { countNoun } from '../../../../shared/utils/countNoun';
import { joinFacts } from '../../../../shared/utils/joinFacts';
import { branchWorkTabRegistration } from '../../branchWorkTabRegistration';
import { useBoardContext } from './useBoardContext';

type Props = {
  readonly rowId: string;
};

const SEPARATOR = ' · ';

export const BoardTileFacts = ({ rowId }: Props) => {
  const { session, rowById, entryByRowId, diffStatByPath } = useBoardContext();
  const entry = entryByRowId.get(rowId) ?? null;
  const mountPath = entry === null ? null : entry.fact.mountPath;
  const work = branchWorkTabRegistration.useWork({
    session,
    mountId: entry === null ? null : entry.fact.mountId,
    mountPath,
  });
  const stat = mountPath === null ? undefined : diffStatByPath.get(mountPath);
  const hasDiff = stat !== undefined && (stat.additions > 0 || stat.deletions > 0);
  const runs = work.counts === null ? 0 : work.counts.runs;
  const asked = rowById.get(rowId)?.askIds.length ?? 0;
  const words = joinFacts({
    facts: [
      runs > 0 && countNoun({ count: runs, one: 'run' }),
      asked > 0 &&
        `${countNoun({ count: asked, one: 'question' })} ${asked === 1 ? 'waits' : 'wait'}`,
    ],
  });
  if (!hasDiff && words === '') {
    return null;
  }
  return (
    <span
      data-board-facts=""
      className="min-w-0 truncate text-meta tabular-nums text-muted-foreground"
    >
      {hasDiff ? (
        <span data-board-diff="">
          <span className="text-success">+{stat.additions}</span>{' '}
          <span className="text-danger">-{stat.deletions}</span>
        </span>
      ) : null}
      {hasDiff && words !== '' ? SEPARATOR : null}
      {words}
    </span>
  );
};
