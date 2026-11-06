import { useEffect, useState } from 'react';
import { Button, EmptyLine, Skeleton, Textarea } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { ContextSection } from './ContextSection';
import { KeyLineList } from './KeyLineList';
import { summaryItems } from './summaryItems';
import { GoalAttachmentsStrip } from '../../../context/components/ContextPanel/strips/GoalAttachmentsStrip';
import { WriteFromWorkButton } from './WriteFromWorkButton';
import { isSubmitChord } from '../../../../shared/keyboard/isSubmitChord';
import type { Visibility } from './roleVisibility';

type Props = {
  readonly sessionId: SessionId;
  readonly value: string;
  readonly historyCount: number;
  readonly isLoading: boolean;
  readonly isLocked: boolean;
  readonly visibility: Visibility | null;
  readonly onOpenVersions: () => void;
};

export const GoalTab = ({
  sessionId,
  value,
  historyCount,
  isLoading,
  isLocked,
  visibility,
  onOpenVersions,
}: Props) => {
  const upsertSessionSlot = useAppStore((state) => state.upsertSessionSlot);
  const reportError = useAppStore((state) => state.reportError);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (isEditing) {
      return;
    }
    setDraft(value);
  }, [isEditing, value]);

  const save = async () => {
    if (draft === value) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await upsertSessionSlot(sessionId, 'goal', draft);
      setIsEditing(false);
    } catch (error: unknown) {
      void reportError({ title: "Couldn't save the goal", error, sessionId });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <ContextSection
        section="goal"
        visibility={visibility}
        isLocked
        historyCount={0}
        onEdit={() => setIsEditing(true)}
        onOpenVersions={onOpenVersions}
      >
        <div role="status" aria-label="Loading goal" className="flex flex-col gap-2">
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </ContextSection>
    );
  }

  if (isEditing) {
    return (
      <ContextSection
        section="goal"
        visibility={visibility}
        isLocked
        historyCount={0}
        onEdit={() => setIsEditing(true)}
        onOpenVersions={onOpenVersions}
      >
        <Textarea
          autoFocus
          disabled={isSaving}
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
              void save();
            }
          }}
          aria-label="Goal"
          className="min-w-0 text-body"
          autoGrow
          minRows={3}
          maxRows={16}
        />
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={isSaving} onClick={() => void save()}>
            Save
          </Button>
        </div>
      </ContextSection>
    );
  }

  if (value.trim() === '') {
    return (
      <ContextSection
        section="goal"
        visibility={visibility}
        isLocked={isLocked}
        historyCount={historyCount}
        onEdit={() => setIsEditing(true)}
        onOpenVersions={onOpenVersions}
      >
        <EmptyLine
          className="self-stretch"
          action={
            <Button size="sm" disabled={isLocked} onClick={() => setIsEditing(true)}>
              Write the goal
            </Button>
          }
        >
          No goal yet. Every agent starts from it.
        </EmptyLine>
        <WriteFromWorkButton sessionId={sessionId} isLocked={isLocked} />
        {isLocked ? (
          <p className="text-meta text-faint-foreground">Editing opens when the update finishes.</p>
        ) : null}
      </ContextSection>
    );
  }

  return (
    <ContextSection
      section="goal"
      visibility={visibility}
      isLocked={isLocked}
      historyCount={historyCount}
      onEdit={() => setIsEditing(true)}
      onOpenVersions={onOpenVersions}
    >
      <KeyLineList items={summaryItems({ body: value })} label="Goal" />
      <WriteFromWorkButton sessionId={sessionId} isLocked={isLocked} />
      <GoalAttachmentsStrip owner={{ type: 'session', id: sessionId }} />
      {isLocked ? (
        <p className="text-meta text-faint-foreground">Editing opens when the update finishes.</p>
      ) : null}
    </ContextSection>
  );
};
