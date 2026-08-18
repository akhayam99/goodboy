import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { CardAction, CardActionSlot, Eyebrow, Markdown } from '@goodboy/ui';
import { BlockEditor } from './BlockEditor';

const REVEAL_GROUP =
  'group-hover/summary-block:opacity-100 group-focus-within/summary-block:opacity-100';

type Props = {
  readonly title: string;
  readonly body: string;
  readonly isLocked: boolean;
  readonly onCommit: (body: string) => void;
};

export const SummaryBlock = ({ title, body, isLocked, onCommit }: Props) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(body);
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
    <section aria-label={title} className="group/summary-block flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3>
          <Eyebrow label={title} />
        </h3>
        {isEditing ? null : (
          <CardActionSlot label={`${title} actions`}>
            <CardAction
              icon={hasBody ? Pencil : Plus}
              label={`${hasBody ? 'Edit' : 'Add'} ${title.toLowerCase()}`}
              reveal={hasBody}
              revealGroup={REVEAL_GROUP}
              disabled={isLocked}
              onClick={startEditing}
            />
          </CardActionSlot>
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
      ) : null}
    </section>
  );
};
