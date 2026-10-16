import { useId, useState, type ClipboardEvent } from 'react';
import { GhostActionButton, SectionHeader, cn, tintClasses } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import {
  ARTIFACT_BRIEF_COUNTER_FLOOR,
  ARTIFACT_BRIEF_LIMITS,
  formatBriefCount,
} from '../../artifactBrief';
import { PromptField } from '../../../../shared/components/PromptField';
import type { ArtifactAttachmentsHandle } from './useArtifactAttachments';
import { ArtifactAttachButton } from './ArtifactAttachButton';
import { ArtifactAttachmentChip } from './ArtifactAttachmentChip';

type Props = {
  readonly label: string;
  readonly placeholder: string;
  readonly value: string;
  readonly goal: string;
  readonly isGoalPending: boolean;
  readonly files: ArtifactAttachmentsHandle;
  readonly onChange: (value: string) => void;
  readonly onSubmit: () => void;
};

const LIMIT = ARTIFACT_BRIEF_LIMITS.chars;

type GoalParams = {
  readonly value: string;
  readonly goal: string;
};

const withGoal = ({ value, goal }: GoalParams): string => {
  const trimmed = value.trimEnd();
  return trimmed.length === 0 ? goal : `${trimmed}\n\n${goal}`;
};

type GoalTitleParams = Readonly<{
  isPending: boolean;
  hasGoal: boolean;
}>;

const goalActionTitle = ({ isPending, hasGoal }: GoalTitleParams): string => {
  if (isPending) {
    return 'The session goal is still loading.';
  }
  if (hasGoal === false) {
    return 'The session has no goal yet.';
  }
  return 'Add the session goal to the brief.';
};

export const ArtifactBriefField = ({
  label,
  placeholder,
  value,
  goal,
  isGoalPending,
  files,
  onChange,
  onSubmit,
}: Props) => {
  const fieldId = useId();
  const [clipNote, setClipNote] = useState<string | null>(null);
  const trimmedGoal = goal.trim();
  const isAtLimit = value.length >= LIMIT;

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = event.clipboardData.getData('text');
    const target = event.currentTarget;
    const selected = target.selectionEnd - target.selectionStart;
    const room = LIMIT - value.length + selected;
    if (pasted.length <= room) {
      return;
    }
    setClipNote(`Pasted text was cut at ${formatBriefCount({ value: LIMIT })} characters.`);
  };

  return (
    <section className="flex min-w-0 flex-col gap-2">
      <SectionHeader
        label={label}
        htmlFor={fieldId}
        action={
          <GhostActionButton
            icon={CONCEPT_ICONS.goal}
            label="Use the session goal"
            disabled={isGoalPending || trimmedGoal.length === 0}
            title={goalActionTitle({
              isPending: isGoalPending,
              hasGoal: trimmedGoal.length > 0,
            })}
            onClick={() => {
              setClipNote(null);
              onChange(withGoal({ value, goal: trimmedGoal }).slice(0, LIMIT));
            }}
          />
        }
      />
      <div
        ref={files.composerRef}
        data-drop-composer
        data-testid="artifact-attachments"
        className={cn(
          'min-w-0 rounded-lg',
          files.isDragging && cn('ring-1 ring-primary', tintClasses('primary').bgSoft),
        )}
      >
        <PromptField
          kind="document"
          label={label}
          id={fieldId}
          minRows={4}
          maxRows={14}
          maxLength={LIMIT}
          value={value}
          placeholder={placeholder}
          testId="artifact-brief"
          hasPreview
          onPaste={onPaste}
          onSubmit={onSubmit}
          keyLabels={{ send: 'start' }}
          footerStart={
            <>
              <ArtifactAttachButton
                worktree={files.worktree}
                fileInputRef={files.fileInputRef}
                onFileInputChange={files.onFileInputChange}
              />
              {files.attachments.map((attachment) => (
                <ArtifactAttachmentChip
                  key={attachment.id}
                  attachment={attachment}
                  worktree={files.worktree}
                  onRemove={() => files.remove({ id: attachment.id })}
                  onMissing={() => files.remove({ id: attachment.id })}
                />
              ))}
            </>
          }
          onChange={(next) => {
            setClipNote(null);
            onChange(next);
          }}
        />
      </div>
      {clipNote === null ? null : (
        <span role="status" className="text-meta text-muted-foreground">
          {clipNote}
        </span>
      )}
      {files.note === null ? null : (
        <span role="status" className="text-meta text-muted-foreground">
          {files.note}
        </span>
      )}
      {value.length >= ARTIFACT_BRIEF_COUNTER_FLOOR ? (
        <span
          data-testid="artifact-brief-counter"
          className={cn(
            'self-end text-meta tabular-nums text-muted-foreground',
            isAtLimit && 'text-warning',
          )}
        >
          {formatBriefCount({ value: value.length })} / {formatBriefCount({ value: LIMIT })}
          {isAtLimit ? ', at the limit' : ''}
        </span>
      ) : null}
    </section>
  );
};
