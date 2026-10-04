import { useMemo, useState } from 'react';
import { Pencil, Plus, type LucideIcon } from 'lucide-react';
import { CardAction, CardActionSlot } from '@goodboy/ui';
import { BlockEditor } from './BlockEditor';
import { ContextBlock } from './ContextBlock';
import { KeyLineList } from './KeyLineList';
import { summaryItems } from './summaryItems';

const REVEAL_GROUP =
  'group-hover/context-block:opacity-100 group-focus-within/context-block:opacity-100';

type Props = {
  readonly title: string;
  readonly body: string;
  readonly icon?: LucideIcon;
  readonly isLocked: boolean;
  readonly onCommit: (body: string) => void;
};

export const SummaryBlock = ({ title, body, icon, isLocked, onCommit }: Props) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(body);
  const items = useMemo(() => summaryItems({ body }), [body]);
  const hasBody = items.length > 0;

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
    <ContextBlock
      title={title}
      icon={icon}
      {...(hasBody && { count: items.length })}
      action={
        isEditing ? null : (
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
        )
      }
    >
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
        <KeyLineList items={items} label={title} />
      ) : (
        <p className="text-meta text-faint-foreground">Nothing yet.</p>
      )}
    </ContextBlock>
  );
};
