import type { KeyboardEvent } from 'react';
import { Pencil } from 'lucide-react';
import { Textarea } from '@goodboy/ui';
import type { OpenQuestionSelectMode } from '@goodboy/types';
import { AnswerOptionRow } from '../AnswerOptionRow';

type Props = {
  readonly value: string;
  readonly open: boolean;
  readonly mode: OpenQuestionSelectMode;
  readonly disabled?: boolean;
  readonly dimmed?: boolean;
  readonly placeholder?: string;
  readonly onToggle: () => void;
  readonly onChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly onEscape: () => void;
};

export const CustomAnswerField = ({
  value,
  open,
  mode,
  disabled = false,
  dimmed = false,
  placeholder = 'Tell the agent what you want instead',
  onToggle,
  onChange,
  onSubmit,
  onEscape,
}: Props) => {
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    event.stopPropagation();
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      onEscape();
    }
  };

  return (
    <AnswerOptionRow
      label="Something else"
      keyHint={<Pencil size={11} aria-hidden />}
      selected={open}
      mode={mode}
      dimmed={dimmed}
      disabled={disabled}
      onToggle={onToggle}
    >
      {open && !disabled ? (
        <Textarea
          autoFocus
          aria-label="Your answer"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoGrow
          minRows={2}
          maxRows={6}
          className="relative z-10 w-full resize-none bg-background text-body"
        />
      ) : (
        <span className="text-label text-muted-foreground">
          {open && value.trim().length > 0 ? value : 'Write your own answer'}
        </span>
      )}
    </AnswerOptionRow>
  );
};
