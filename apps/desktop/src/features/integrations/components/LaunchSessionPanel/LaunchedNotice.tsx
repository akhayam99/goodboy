import { MessagesSquare } from 'lucide-react';
import type { SessionId } from '@goodboy/types';
import { OpenSessionButton } from '../../../../shared/components/OpenSessionButton';

type Props = {
  readonly sessionId: SessionId;
  readonly isLinkedToIssue: boolean;
  readonly onOpened: () => void;
};

export const LaunchedNotice = ({ sessionId, isLinkedToIssue, onOpened }: Props) => {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-success/15">
        <MessagesSquare size={14} className="text-success" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs font-medium text-foreground">Session already launched</span>
        <span className="truncate text-2xs text-muted-foreground">
          {isLinkedToIssue
            ? 'A session is linked to this issue.'
            : 'A session is already on this branch.'}
        </span>
      </div>
      <OpenSessionButton sessionId={sessionId} onOpened={onOpened} />
    </div>
  );
};
