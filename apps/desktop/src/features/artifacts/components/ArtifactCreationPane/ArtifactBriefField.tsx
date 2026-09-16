import { useId, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { GhostActionButton, SectionHeader, Textarea, cn } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import {
  ARTIFACT_BRIEF_COUNTER_FLOOR,
  ARTIFACT_BRIEF_LIMITS,
  formatBriefCount,
} from '../../artifactBrief';

type Props = {
  readonly label: string;
  readonly placeholder: string;
  readonly value: string;
  readonly goal: string;
  readonly defaultRequest: string;
  readonly onChange: (value: string) => void;
  readonly onSubmit: () => void;
};

const LIMIT = ARTIFACT_BRIEF_LIMITS.chars;

const withGoal = ({ value, goal }: { readonly value: string; readonly goal: string }): string => {
  const trimmed = value.trimEnd();
  return trimmed.length === 0 ? goal : `${trimmed}\n\n${goal}`;
};

export const ArtifactBriefField = ({
  label,
  placeholder,
  value,
  goal,
  defaultRequest,
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
    setClipNote(`pasted text was cut at ${formatBriefCount({ value: LIMIT })} characters`);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      onSubmit();
    }
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
            disabled={trimmedGoal.length === 0}
            title={
              trimmedGoal.length === 0
                ? 'the session has no goal yet'
                : 'add the session goal to the brief'
            }
            onClick={() => {
              setClipNote(null);
              onChange(withGoal({ value, goal: trimmedGoal }).slice(0, LIMIT));
            }}
          />
        }
      />
      <Textarea
        id={fieldId}
        autoGrow
        minRows={4}
        maxRows={14}
        maxLength={LIMIT}
        value={value}
        placeholder={placeholder}
        data-testid="artifact-brief"
        onPaste={onPaste}
        onKeyDown={onKeyDown}
        onChange={(event) => {
          setClipNote(null);
          onChange(event.target.value);
        }}
      />
      {clipNote === null ? null : (
        <span role="status" className="text-2xs text-muted-foreground">
          {clipNote}
        </span>
      )}
      {value.trim().length === 0 ? (
        <span className="text-2xs leading-relaxed text-muted-foreground">
          with no brief the agent is asked to: {defaultRequest}
        </span>
      ) : null}
      {value.length >= ARTIFACT_BRIEF_COUNTER_FLOOR ? (
        <span
          data-testid="artifact-brief-counter"
          className={cn(
            'self-end text-2xs tabular-nums text-muted-foreground',
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
