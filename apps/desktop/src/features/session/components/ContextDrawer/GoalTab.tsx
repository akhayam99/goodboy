import { useEffect, useState } from 'react';
import { Button, Skeleton, Textarea } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { ContextBlock } from './ContextBlock';
import { KeyLineList } from './KeyLineList';
import { summaryItems } from './summaryItems';
import { GoalAttachmentsStrip } from '../../../context/components/ContextPanel/strips/GoalAttachmentsStrip';
import { isSubmitChord } from '../../../../shared/keyboard/isSubmitChord';

type Props = {
  readonly sessionId: SessionId;
  readonly value: string;
  readonly historyCount: number;
  readonly isLoading: boolean;
  readonly isLocked: boolean;
  readonly onOpenVersions: () => void;
};

export const GoalTab = ({
  sessionId,
  value,
  historyCount,
  isLoading,
  isLocked,
  onOpenVersions,
}: Props) => {
  const upsertSessionSlot = useAppStore((state) => state.upsertSessionSlot);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (isEditing) {
      return;
    }
    setDraft(value);
  }, [isEditing, value]);

  const save = () => {
    setIsEditing(false);
    if (draft === value) {
      return;
    }
    void upsertSessionSlot(sessionId, 'goal', draft);
  };

  if (isLoading) {
    return (
      <div role="status" aria-label="Loading goal" className="flex flex-col gap-2">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="flex flex-col gap-2">
        <Textarea
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              setDraft(value);
              setIsEditing(false);
              return;
            }
            if (isSubmitChord(event)) {
              event.preventDefault();
              save();
            }
          }}
          aria-label="Goal"
          className="min-w-0 text-body"
          autoGrow
          minRows={3}
          maxRows={16}
        />
        <div className="flex items-center justify-end gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={save}>
            Save
          </Button>
        </div>
      </div>
    );
  }

  if (value.trim() === '') {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-body text-muted-foreground">No goal yet. Every agent starts from it.</p>
        <Button size="sm" disabled={isLocked} onClick={() => setIsEditing(true)}>
          Write the goal
        </Button>
        {isLocked ? (
          <p className="text-secondary text-faint-foreground">
            Editing opens when the update finishes.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ContextBlock
        title="Goal"
        icon={CONCEPT_ICONS.goal}
        action={
          <div className="flex items-center gap-1">
            {historyCount > 0 ? (
              <Button variant="ghost" size="sm" onClick={onOpenVersions}>
                {`Versions ${historyCount}`}
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              disabled={isLocked}
              onClick={() => setIsEditing(true)}
            >
              Edit
            </Button>
          </div>
        }
      >
        <KeyLineList items={summaryItems({ body: value })} label="Goal" />
      </ContextBlock>
      <GoalAttachmentsStrip owner={{ type: 'session', id: sessionId }} />
      {isLocked ? (
        <p className="text-secondary text-faint-foreground">
          Editing opens when the update finishes.
        </p>
      ) : null}
    </div>
  );
};
