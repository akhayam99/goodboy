import { countNoun } from '../../../../shared/utils/countNoun';
import { joinFacts } from '../../../../shared/utils/joinFacts';
import { boardSettledWordOf } from '../../central/board/boardSettledWordOf';
import { requestShortOf } from '../../central/board/requestShortOf';
import { branchWorkTabRegistration } from '../../branchWorkTabRegistration';
import { useBoardContext } from './useBoardContext';

type Props = {
  readonly rowId: string;
};

const SEPARATOR = ' · ';

export const BoardTileFacts = ({ rowId }: Props) => {
  const { session, rowById, entryByRowId, diffStatByPath, runningByRowId } = useBoardContext();
  const entry = entryByRowId.get(rowId) ?? null;
  const mountPath = entry === null ? null : entry.fact.mountPath;
  const work = branchWorkTabRegistration.useWork({
    session,
    mountId: entry === null ? null : entry.fact.mountId,
    mountPath,
  });
  const stat = mountPath === null ? undefined : diffStatByPath.get(mountPath);
  const isRunning = (runningByRowId.get(rowId) ?? 0) > 0;
  const hasDiff = !isRunning && stat !== undefined && (stat.additions > 0 || stat.deletions > 0);
  const request = entry === null ? null : entry.fact.request;
  const requestWord =
    request === null ? '' : `${requestShortOf({ request })} ${request.noun}${request.number}`;
  const runs = work.counts === null ? 0 : work.counts.runs;
  const row = rowById.get(rowId);
  const asked = row?.askIds.length ?? 0;
  const settled = row === undefined ? null : boardSettledWordOf({ row });
  const words = joinFacts({
    facts: [
      settled?.word,
      runs > 0 && countNoun({ count: runs, one: 'run' }),
      asked > 0 &&
        `${countNoun({ count: asked, one: 'question' })} ${asked === 1 ? 'waits' : 'wait'}`,
    ],
  });
  if (requestWord === '' && !hasDiff && words === '') {
    return null;
  }
  return (
    <span
      data-board-facts=""
      className="min-w-0 truncate text-meta tabular-nums text-muted-foreground"
    >
      {requestWord === '' ? null : <span data-board-request="">{requestWord}</span>}
      {requestWord !== '' && (hasDiff || words !== '') ? SEPARATOR : null}
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
