import type { SessionId } from '@goodboy/types';
import type { ChangeFile } from '../../../file-versions/changeTurnsOf';
import { useChangeSides } from '../../../file-versions/useChangeSides';

type Props = {
  readonly sessionId: SessionId;
  readonly file: ChangeFile;
};

const FILE_STATE = {
  added: 'new file',
  modified: null,
  deleted: 'removed',
} as const satisfies Record<ChangeFile['change'], string | null>;

export const TurnChangesFile = ({ sessionId, file }: Props) => {
  const { sides } = useChangeSides({ sessionId, file });
  const isShowingCounts =
    sides.status === 'text' && file.change === 'modified' && file.restoreRunId === null;
  const counts = isShowingCounts && sides.status === 'text' ? sides.changes : null;
  const state = file.restoreRunId === null ? FILE_STATE[file.change] : 'restored';

  return (
    <li className="flex min-w-0 items-baseline gap-2 text-ui">
      <span className="min-w-0 truncate text-foreground">{file.label}</span>
      {state === null ? null : (
        <span className="shrink-0 text-meta text-faint-foreground">{state}</span>
      )}
      {counts === null ? null : (
        <span className="flex shrink-0 gap-2 text-meta tabular-nums">
          {counts.additions === 0 ? null : (
            <span className="text-success">+{counts.additions}</span>
          )}
          {counts.deletions === 0 ? null : <span className="text-danger">-{counts.deletions}</span>}
        </span>
      )}
    </li>
  );
};
