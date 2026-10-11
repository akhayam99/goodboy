import { Button } from '@goodboy/ui';
import type { SessionExternalTaskProvider } from '@goodboy/types';
import { TaskLinkChip } from '../../../../shared/components/TaskLinkChip';
import { LINKED_LABEL } from './linkScope';

type Props = {
  readonly provider: SessionExternalTaskProvider;
  readonly identifier: string;
  readonly isClosing: boolean;
  readonly isLinking: boolean;
  readonly isDuplicate: boolean;
  readonly canStar: boolean;
  readonly isStarred: boolean;
  readonly onStar: () => void;
  readonly onToggleClosing: () => void;
  readonly onLink: () => void;
  readonly onCancel: () => void;
};

export const LinkScopePreview = ({
  provider,
  identifier,
  isClosing,
  isLinking,
  isDuplicate,
  canStar,
  isStarred,
  onStar,
  onToggleClosing,
  onLink,
  onCancel,
}: Props) => (
  <div aria-label="Link preview" className="flex flex-col gap-2 px-3 py-3">
    <div className="flex min-w-0 items-center gap-2">
      <TaskLinkChip provider={provider} identifier={identifier} />
      <span className="truncate text-label text-muted-foreground">not on a branch yet</span>
    </div>
    <p className="text-label text-foreground">
      {isDuplicate ? (
        `${LINKED_LABEL} already.`
      ) : isClosing ? (
        <>
          {`Will close ${identifier} when merged · `}
          <button
            type="button"
            onClick={onToggleClosing}
            className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            Don’t close
          </button>
        </>
      ) : (
        <>
          {`Part of ${identifier}. It stays open when merged. `}
          <button
            type="button"
            onClick={onToggleClosing}
            className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            Close it instead
          </button>
        </>
      )}
    </p>
    <div className="flex items-center gap-2">
      <Button size="sm" variant="primary" disabled={isLinking || isDuplicate} onClick={onLink}>
        {`Link ${identifier}`}
      </Button>
      {canStar ? (
        <Button size="sm" variant="ghost" disabled={isLinking || isStarred} onClick={onStar}>
          {isStarred ? 'Starred' : 'Star it'}
        </Button>
      ) : null}
      <Button size="sm" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  </div>
);
