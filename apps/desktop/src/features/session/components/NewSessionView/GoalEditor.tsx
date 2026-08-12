import type { KeyboardEvent } from 'react';
import { Button, Divider, ScrollFade, Skeleton, Textarea } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { PANE_RHYTHM } from '../../../../shared/components/paneRhythm';

type Props = {
  readonly draft: string;
  readonly polishing: boolean;
  readonly onDraftChange: (value: string) => void;
  readonly onCancel: () => void;
  readonly onPolish: () => void;
  readonly onSave: () => void;
};

type KeyDownParams = {
  readonly event: KeyboardEvent<HTMLDivElement>;
};

export const GoalEditor = ({
  draft,
  polishing,
  onDraftChange,
  onCancel,
  onPolish,
  onSave,
}: Props) => {
  const onKeyDown = ({ event }: KeyDownParams) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== 'Enter' || (!event.metaKey && !event.ctrlKey) || polishing) {
      return;
    }
    event.preventDefault();
    onSave();
  };

  return (
    <div
      data-studio-overlay
      className="flex min-h-0 flex-1 flex-col"
      onKeyDown={(event) => onKeyDown({ event })}
    >
      <div className="flex shrink-0 flex-col gap-4 px-6 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-sm font-medium text-foreground">Edit goal</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Shape the full session objective. Escape cancels, Cmd or Ctrl plus Enter saves.
          </p>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onPolish}
            disabled={draft.trim().length === 0 || polishing}
          >
            <CONCEPT_ICONS.enhance size={13} aria-hidden />
            Polish
          </Button>
          <Button size="sm" onClick={onSave} disabled={polishing}>
            Save
          </Button>
        </div>
      </div>
      <Divider />
      <ScrollFade className="min-h-0 flex-1" viewportClassName={PANE_RHYTHM.body} fadeSize={24}>
        {polishing ? (
          <Skeleton className="h-80 w-full rounded-lg" />
        ) : (
          <Textarea
            autoFocus
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            aria-label="Goal editor"
            className="min-h-80 w-full text-sm leading-relaxed"
            autoGrow
            minRows={18}
            maxRows={80}
          />
        )}
      </ScrollFade>
    </div>
  );
};
