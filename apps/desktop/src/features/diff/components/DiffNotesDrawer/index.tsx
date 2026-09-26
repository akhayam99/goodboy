import { useMemo } from 'react';
import { MessageSquare } from 'lucide-react';
import { DrawerFrame, EmptyState } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { useDiffNotes } from '../../hooks/useDiffNotes';
import { CommentThread } from '../DiffView/CommentThread';
import type { DiffThread } from '../DiffView/types';

type Props = {
  readonly sessionId: SessionId;
  readonly onClose: () => void;
};

const anchorLabel = (thread: DiffThread): string => {
  if (thread.anchor === null) {
    return 'File';
  }
  const { lineNumber, endLineNumber } = thread.anchor;
  return endLineNumber && endLineNumber !== lineNumber
    ? `Lines ${lineNumber} to ${endLineNumber}`
    : `Line ${lineNumber}`;
};

export const DiffNotesDrawer = ({ sessionId, onClose }: Props) => {
  const { comments } = useDiffNotes({ sessionId });
  const setDiffFocus = useAppStore((state) => state.setDiffFocus);
  const open = useMemo(
    () => comments.threads.filter((thread) => !thread.isResolved),
    [comments.threads],
  );
  const groups = useMemo(() => {
    const byPath = new Map<string, DiffThread[]>();
    for (const thread of open) {
      const list = byPath.get(thread.filePath) ?? [];
      list.push(thread);
      byPath.set(thread.filePath, list);
    }
    return [...byPath.entries()];
  }, [open]);

  return (
    <DrawerFrame
      title="Notes"
      icon={MessageSquare}
      iconClassName="text-muted-foreground"
      count={open.length}
      closeLabel="Close notes"
      onClose={onClose}
    >
      {groups.length === 0 ? (
        <EmptyState
          icon={CONCEPT_ICONS.diff}
          tone={CONCEPT_TONE.diff}
          title="No open notes"
          description="Click a line number in the diff to leave a note for the agents."
          size="inline"
        />
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(([path, threads]) => (
            <div key={path} className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setDiffFocus(sessionId, { kind: 'branch', path })}
                className="w-fit truncate rounded-sm font-mono text-secondary text-muted-foreground hover:text-foreground"
              >
                {path}
              </button>
              {threads.map((thread) => (
                <div key={thread.id} className="flex flex-col gap-1">
                  <span className="text-secondary text-faint-foreground">
                    {anchorLabel(thread)}
                  </span>
                  <CommentThread thread={thread} comments={comments} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </DrawerFrame>
  );
};
