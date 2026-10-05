import { useEffect } from 'react';
import type { SessionId } from '@goodboy/types';
import { Button } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { selectActiveMount } from '../../../../store/slices/project-mounts/selectors';
import { useBranchNotes } from '../../../resolve/notes/useBranchNotes';

type Props = {
  readonly sessionId: SessionId;
};

const lineOf = ({
  filePath,
  line,
}: {
  readonly filePath: string;
  readonly line: number | undefined;
}): string => (line === undefined ? filePath : `${filePath}:${line}`);

export const UnassignedNotes = ({ sessionId }: Props) => {
  const { unassigned } = useBranchNotes({ sessionId });
  const loadDiffComments = useAppStore((s) => s.loadDiffComments);
  const assignDiffComment = useAppStore((s) => s.assignDiffComment);
  const branch = useAppStore((s) => selectActiveMount({ state: s, sessionId })?.branch ?? null);

  useEffect(() => {
    void loadDiffComments(sessionId);
  }, [loadDiffComments, sessionId]);

  if (unassigned.length === 0) {
    return null;
  }

  return (
    <section aria-label="Unassigned notes" className="flex min-w-0 flex-col gap-2">
      <h2 className="flex items-baseline gap-2 text-label text-foreground">
        Unassigned notes
        <span className="tabular-nums text-faint-foreground">{unassigned.length}</span>
      </h2>
      <p className="text-meta text-muted-foreground">
        Written before notes were tied to a branch. They stay here until you move them.
      </p>
      <ul className="flex min-w-0 flex-col gap-2">
        {unassigned.map((note) => (
          <li
            key={note.id}
            className="flex min-w-0 items-start gap-3 rounded-lg border border-border-soft bg-elevated px-3 py-2"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate font-mono text-meta text-muted-foreground">
                {lineOf({ filePath: note.filePath, line: note.anchor?.lineNumber })}
              </span>
              <p className="whitespace-pre-wrap break-words text-body text-foreground">
                {note.body}
              </p>
            </div>
            {branch !== null && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void assignDiffComment(sessionId, note.id)}
              >
                Move to {branch}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};
