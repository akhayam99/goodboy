import { useEffect, useState, type KeyboardEvent } from 'react';
import { Check, X } from 'lucide-react';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { GhostActionButton, Input, Textarea, cn } from '@goodboy/ui';

type Props = {
  readonly initialMessage: string;
  readonly suggestion: string | null;
  readonly isSuggesting: boolean;
  readonly onSuggest: (() => void) | null;
  readonly onSave: (message: string) => void;
  readonly onCancel: () => void;
};

const SUBJECT_LIMIT = 72;

const splitMessage = ({ message }: { readonly message: string }) => {
  const [subject = '', ...rest] = message.split('\n');
  return { subject, body: rest.join('\n').trim() };
};

export const RewordEditor = ({
  initialMessage,
  suggestion,
  isSuggesting,
  onSuggest,
  onSave,
  onCancel,
}: Props) => {
  const initial = splitMessage({ message: initialMessage });
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);

  useEffect(() => {
    if (suggestion === null) {
      return;
    }
    const next = splitMessage({ message: suggestion });
    setSubject(next.subject);
    setBody(next.body);
  }, [suggestion]);

  const message = body === '' ? subject.trim() : `${subject.trim()}\n\n${body}`;
  const canSave = subject.trim() !== '';
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey && event.target instanceof HTMLInputElement) {
      event.preventDefault();
      if (canSave) {
        onSave(message);
      }
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-1.5" onKeyDown={onKeyDown}>
      <div className="flex min-w-0 items-center gap-2">
        <Input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          aria-label="Commit subject"
          placeholder="Commit subject"
          className="h-7 min-w-0 flex-1 text-label"
          autoFocus
        />
        <span
          className={cn(
            'shrink-0 text-chip tabular-nums',
            subject.length > SUBJECT_LIMIT ? 'text-warning' : 'text-faint-foreground',
          )}
        >
          {subject.length}/{SUBJECT_LIMIT}
        </span>
      </div>
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        aria-label="Commit body"
        placeholder="Body, optional"
        className="text-label"
        autoGrow
        minRows={1}
        maxRows={6}
      />
      <div className="flex items-center gap-1">
        <GhostActionButton
          icon={Check}
          label="Save to the plan"
          disabled={!canSave}
          onClick={() => onSave(message)}
        />
        <GhostActionButton icon={X} label="Cancel" onClick={onCancel} />
        {onSuggest !== null ? (
          <GhostActionButton
            icon={CONCEPT_ICONS.suggestion}
            label={isSuggesting ? 'Scribe is writing…' : 'Suggest a message'}
            disabled={isSuggesting}
            onClick={onSuggest}
          />
        ) : null}
      </div>
    </div>
  );
};
