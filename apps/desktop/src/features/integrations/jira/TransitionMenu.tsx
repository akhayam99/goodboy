import { useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import {
  AnchoredPopover,
  Button,
  cn,
  Divider,
  formatError,
  ScrollFade,
  useDropdown,
} from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useJiraTransitions } from './useJiraTransitions';

type Props = {
  readonly issueKey: string;
  readonly workspaceId: WorkspaceId;
  readonly onTransition: (transitionId: string) => Promise<void>;
};

type ReasonParams = {
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly count: number;
};

const MENU_ROW =
  'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50';

const SCREEN_HINT = 'Jira asks for extra fields on this move. Goodboy sends it without them.';

const blockReason = ({ isLoading, error, count }: ReasonParams): string | null => {
  if (isLoading) {
    return 'Reading the Jira workflow for this issue';
  }
  if (error != null) {
    return `Could not read the Jira workflow for this issue. ${error}`;
  }
  if (count === 0) {
    return 'Jira offers no move from this status';
  }
  return null;
};

export const TransitionMenu = ({ issueKey, workspaceId, onTransition }: Props) => {
  const { transitions, isLoading, error, reload } = useJiraTransitions({ issueKey, workspaceId });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const reason = blockReason({ isLoading, error, count: transitions.length });
  const isBlocked = reason != null;
  const dropdown = useDropdown({
    disabled: isBlocked,
    align: 'end',
    width: 'w-60',
    expectedHeight: 280,
  });
  const { open: isOpen, close, toggle } = dropdown;

  const move = async (transitionId: string) => {
    setBusyId(transitionId);
    setMoveError(null);
    try {
      await onTransition(transitionId);
      close();
      reload();
    } catch (moveFailure: unknown) {
      setMoveError(formatError(moveFailure));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="menu"
      ariaLabel="Move this issue"
      className="flex flex-col"
      hasBackdrop
      trigger={
        <Button
          size="sm"
          variant="secondary"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-disabled={isBlocked}
          title={reason ?? 'Move this issue through its Jira workflow'}
          isBusy={busyId != null}
          busyLabel="Moving"
          className={cn(isBlocked && 'opacity-50')}
          onClick={toggle}
        >
          <ArrowRightLeft size={12} aria-hidden />
          Move
        </Button>
      }
    >
      <ScrollFade className="max-h-64" viewportClassName="flex flex-col gap-0.5 p-1">
        {transitions.map((transition) => (
          <button
            key={transition.id}
            type="button"
            role="menuitem"
            disabled={busyId != null}
            title={transition.hasScreen ? SCREEN_HINT : undefined}
            onClick={() => void move(transition.id)}
            className={MENU_ROW}
          >
            <span className="min-w-0 truncate">{transition.name}</span>
            {transition.to != null && (
              <span className="shrink-0 text-2xs text-muted-foreground">{transition.to.name}</span>
            )}
          </button>
        ))}
      </ScrollFade>
      {moveError != null && (
        <>
          <Divider />
          <p role="alert" className="px-2 py-1.5 text-2xs text-danger">
            {moveError}
          </p>
        </>
      )}
    </AnchoredPopover>
  );
};
