import { Button, Notice } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';

type Props = {
  readonly sessionId: SessionId;
};

const plural = (count: number): string => (count === 1 ? 'file' : 'files');

export const MoveReport = ({ sessionId }: Props) => {
  const report = useAppStore((state) =>
    Object.values(state.bootstrapMoveReport).find(
      (entry) => entry.bootstrapSessionId === sessionId,
    ),
  );
  const dismiss = useAppStore((state) => state.dismissBootstrapReport);

  if (report === undefined) {
    return null;
  }
  const notes: ReadonlyArray<string> = [
    report.kept.length > 0
      ? `Left in the project folder because they changed again: ${report.kept.join(', ')}`
      : null,
    report.largeFiles.length > 0
      ? `GitHub refuses files over 100 MB when you publish this session: ${report.largeFiles.join(', ')}`
      : null,
    report.ignoredAtRisk.length > 0
      ? `Ignored files stay in the project folder: ${report.ignoredAtRisk.join(', ')}`
      : null,
    report.aligned?.kind === 'skipped' && report.aligned.reason === 'histories-differ'
      ? 'Your local main was left as it is because it differs from the remote main.'
      : null,
  ].filter((note): note is string => note !== null);

  return (
    <div className="flex flex-col gap-2 bg-subtle px-4 py-3">
      <Notice
        tone="success"
        placement="inline"
        role="status"
        title={`Moved ${report.movedCount} ${plural(report.movedCount)} into this session`}
        body="The project folder is clean on main. Everything from now on starts from the published main."
        actions={
          <Button
            size="sm"
            variant="ghost"
            onClick={() => dismiss({ projectId: report.projectId })}
          >
            Dismiss
          </Button>
        }
      />
      {notes.length > 0 ? (
        <ul className="flex flex-col gap-1 text-secondary text-muted-foreground">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
