import type { ReactNode } from 'react';
import {
  CircleHelp,
  FolderGit2,
  GitPullRequestArrow,
  ListChecks,
  MessageSquareReply,
  Play,
  X,
} from 'lucide-react';
import { Button, cn, PANE_RHYTHM, Tooltip } from '@goodboy/ui';
import type { SessionSuggestion } from '../../types';

type Props = {
  readonly suggestion: SessionSuggestion;
  readonly size: 'row' | 'card' | 'compact';
  readonly actionLabel: string;
  readonly onAction: () => void;
  readonly action?: ReactNode;
  readonly onDismiss?: () => void;
  readonly isDisabled?: boolean;
};

const ICONS = {
  'workflow-next-step': Play,
  'plan-ready': ListChecks,
  'resolve-threads': MessageSquareReply,
  'rebase-project': GitPullRequestArrow,
  'answer-questions': CircleHelp,
  'mount-project': FolderGit2,
} satisfies Record<SessionSuggestion['kind'], typeof Play>;

export const SuggestionRow = ({
  suggestion,
  size,
  actionLabel,
  onAction,
  action,
  onDismiss,
  isDisabled = false,
}: Props) => {
  const Icon = ICONS[suggestion.kind];
  return (
    <div
      data-testid={`suggestion-${suggestion.id}`}
      className={cn(
        'flex w-full items-center gap-3 border border-border-soft bg-surface-raised',
        size === 'row' && 'rounded-lg px-3 py-1.5',
        size === 'card' && 'rounded-xl px-4 py-3',
        size === 'compact' && cn('rounded-md', PANE_RHYTHM.navRail.row),
      )}
    >
      <Icon
        size={size === 'compact' ? 12 : 14}
        className="shrink-0 text-muted-foreground"
        aria-hidden
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm text-foreground">{suggestion.title}</span>
        {suggestion.detail != null ? (
          <span className="truncate text-xs text-muted-foreground">{suggestion.detail}</span>
        ) : null}
      </span>
      {action ?? (
        <Button
          size="sm"
          variant="secondary"
          emphasis="outline"
          disabled={isDisabled}
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      )}
      {onDismiss != null ? (
        <Tooltip content="Dismiss suggestion">
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss suggestion"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X size={12} aria-hidden />
          </button>
        </Tooltip>
      ) : null}
    </div>
  );
};
