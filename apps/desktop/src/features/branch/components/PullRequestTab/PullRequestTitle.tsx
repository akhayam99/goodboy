import type { KeyboardEvent } from 'react';
import { FOCUS_RING, cn } from '@goodboy/ui';
import type { PullRequestTitleEdit } from '../../hooks/usePullRequestTitleEdit';

type Props = {
  readonly title: string;
  readonly edit: PullRequestTitleEdit;
};

export const PullRequestTitle = ({ title, edit }: Props) => {
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
        aria-label="Pull request title"
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
    <button
      type="button"
      title="Edit title (E)"
      onClick={edit.start}
      className={cn(
        '-mx-2 flex min-h-8 max-w-full min-w-0 cursor-text items-center rounded-md px-2 text-left',
        'motion-safe:transition-colors hover:bg-hover',
        FOCUS_RING,
      )}
    >
      <span className="min-w-0 truncate">{title}</span>
    </button>
  );
};
