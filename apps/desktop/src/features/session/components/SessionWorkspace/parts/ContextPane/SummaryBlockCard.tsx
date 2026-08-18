import { useState } from 'react';
import { Button, Eyebrow, Markdown, cn, tintClasses, type Tone } from '@goodboy/ui';
import { BlockEditor } from './BlockEditor';

type Props = {
  readonly title: string;
  readonly body: string;
  readonly tone: Tone;
  readonly isLocked: boolean;
  readonly onCommit: (body: string) => void;
};

export const SummaryBlockCard = ({ title, body, tone, isLocked, onCommit }: Props) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(body);
  const tint = tintClasses(tone);
  const hasBody = body.trim() !== '';

  const startEditing = () => {
    setDraft(body);
    setIsEditing(true);
  };

  const commit = () => {
    setIsEditing(false);
    if (draft === body) {
      return;
    }
    onCommit(draft);
  };

  return (
    <section
      aria-label={title}
      className={cn('flex flex-col gap-2 rounded-lg border bg-muted/30 p-3', tint.borderSoft)}
    >
      <div className="flex items-center justify-between gap-2">
        <h3>
          <Eyebrow label={title} />
        </h3>
        {isEditing ? null : (
          <Button
            size="sm"
            variant="ghost"
            onClick={startEditing}
            disabled={isLocked}
            aria-label={`${hasBody ? 'Edit' : 'Add'} ${title.toLowerCase()}`}
            className="h-6 px-2 text-2xs"
          >
            {hasBody ? 'Edit' : 'Add'}
          </Button>
        )}
      </div>
      {isEditing ? (
        <BlockEditor
          value={draft}
          label={`${title} body`}
          onChange={setDraft}
          onCommit={commit}
          onCancel={() => {
            setDraft(body);
            setIsEditing(false);
          }}
        />
      ) : hasBody ? (
        <div className="text-sm leading-relaxed [overflow-wrap:anywhere] [&_pre]:whitespace-pre-wrap">
          <Markdown text={body} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nothing here yet</p>
      )}
    </section>
  );
};
