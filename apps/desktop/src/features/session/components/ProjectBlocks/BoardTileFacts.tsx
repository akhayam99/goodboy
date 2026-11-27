import { Button, tintClasses } from '@goodboy/ui';
import { brandId, type MountId } from '@goodboy/types';
import { OverlapCard } from '../../../overlap/OverlapCard';
import { countNoun } from '../../../../shared/utils/countNoun';
import type { BranchRowWord } from '../../central/board/branchRowOf';
import { joinFacts } from '../../../../shared/utils/joinFacts';
import { requestShortOf } from '../../central/board/requestShortOf';
import { branchWorkTabRegistration } from '../../branchWorkTabRegistration';
import { openLink } from '../../../open/openLink';
import { useBoardContext } from './useBoardContext';

type Props = {
  readonly rowId: string;
  readonly title: string;
  readonly word: BranchRowWord | null;
  readonly hoverFacts: ReadonlyArray<string>;
  readonly onOpenChanges: () => void;
};

const SEPARATOR = ' · ';

export const BoardTileFacts = ({ rowId, title, word, hoverFacts, onOpenChanges }: Props) => {
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
  const isSettled = rowById.get(rowId)?.isSettled === true;
  const linkUrl = request === null || !isSettled || request.url === '' ? null : request.url;
  const runs = work.counts === null ? 0 : work.counts.runs;
  const words = joinFacts({
    facts: [runs > 0 && countNoun({ count: runs, one: 'run' })],
  });
  if (requestWord === '' && !hasDiff && words === '' && word === null) {
    return null;
  }
  return (
    <span
      data-board-facts=""
      className="min-w-0 truncate text-meta tabular-nums text-muted-foreground"
    >
      {requestWord === '' ? null : linkUrl === null ? (
        <span data-board-request="">{requestWord}</span>
      ) : (
        <Button
          variant="quiet"
          role="link"
          data-board-request=""
          aria-label={`Open ${requestWord}`}
          onClick={(event) => openLink({ url: linkUrl, sessionId: session.id, event })}
          className="pointer-events-auto relative h-auto w-auto min-w-0 rounded-sm px-0 py-0 text-meta font-normal tabular-nums"
        >
          {requestWord}
        </Button>
      )}
      {requestWord !== '' && word !== null ? SEPARATOR : null}
      {word === null ? null : entry === null ? (
        <span data-board-word="" className={tintClasses(word.tone).text}>
          {word.word}
        </span>
      ) : (
        <OverlapCard
          mountId={brandId<MountId>({ value: entry.fact.mountId })}
          word={word}
          facts={hoverFacts}
        />
      )}
      {(requestWord !== '' || word !== null) && (hasDiff || words !== '') ? SEPARATOR : null}
      {hasDiff ? (
        <Button
          variant="quiet"
          data-board-diff=""
          aria-label={`Open ${title} in Changes`}
          aria-description={`${stat.additions} added, ${stat.deletions} removed`}
          onClick={onOpenChanges}
          className="pointer-events-auto relative h-auto w-auto min-w-0 rounded-sm px-0 py-0 text-meta font-normal tabular-nums"
        >
          <span className="text-success">+{stat.additions}</span>{' '}
          <span className="text-danger">-{stat.deletions}</span>
        </Button>
      ) : null}
      {hasDiff && words !== '' ? SEPARATOR : null}
      {words}
    </span>
  );
};
