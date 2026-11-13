import type { KeyboardEvent } from 'react';
import { FOCUS_RING, Tooltip, cn } from '@goodboy/ui';
import type { PullRequestTitleEdit } from '../../hooks/usePullRequestTitleEdit';

type Props = {
  readonly title: string;
  readonly edit: PullRequestTitleEdit;
  readonly noun?: string;
};

export const PullRequestTitle = ({ title, edit, noun = 'Pull request' }: Props) => {
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      edit.save();
    }
  };

  if (edit.isEditing) {
    return (
      <input
        autoFocus
        value={edit.draft}
        disabled={edit.isBusy}
        aria-label={`${noun} title`}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => edit.setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onFocus={(event) => event.currentTarget.select()}
        className={cn(
          'h-8 w-full min-w-0 rounded-md border border-border bg-background px-2 text-title text-foreground',
          'disabled:text-disabled-foreground',
          FOCUS_RING,
        )}
      />
    );
  }

  if (!edit.canEdit) {
    return <span className="min-w-0 truncate">{title}</span>;
  }

  return (
    <Tooltip content="Edit title (E)">
      <button
        type="button"
        aria-keyshortcuts="E"
        onClick={edit.start}
        className={cn(
          'flex min-h-8 max-w-full min-w-0 cursor-text items-center rounded-md text-left',
          'decoration-border underline-offset-4 hover:underline',
          FOCUS_RING,
        )}
      >
        <span className="min-w-0 truncate">{title}</span>
      </button>
    </Tooltip>
  );
};
