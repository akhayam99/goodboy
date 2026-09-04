import { useState } from 'react';
import { Pencil, Plus, type LucideIcon } from 'lucide-react';
import { CardAction, CardActionSlot, Eyebrow, Markdown } from '@goodboy/ui';
import { BlockEditor } from './BlockEditor';
import { ICON_SIZE } from '../../../../../../shared/components/conceptIcons';

const REVEAL_GROUP =
  'group-hover/summary-block:opacity-100 group-focus-within/summary-block:opacity-100';

type Props = {
  readonly title: string;
  readonly body: string;
  readonly icon?: LucideIcon;
  readonly isLocked: boolean;
  readonly onCommit: (body: string) => void;
};

export const SummaryBlock = ({ title, body, icon: Icon, isLocked, onCommit }: Props) => {
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
          <Eyebrow
            label={title}
            icon={Icon != null ? <Icon size={ICON_SIZE.row} aria-hidden /> : undefined}
          />
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
