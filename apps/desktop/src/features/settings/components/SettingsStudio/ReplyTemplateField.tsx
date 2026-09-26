import { useEffect, useId, useState } from 'react';
import { Textarea } from '@goodboy/ui';
import {
  REPLY_TEMPLATE_VARIABLES,
  replyTemplateProblems,
} from '../../../resolve/renderReplyTemplate';

type Props = {
  readonly label: string;
  readonly value: string;
  readonly isDisabled: boolean;
  readonly onSave: (value: string) => void;
};

export const ReplyTemplateField = ({ label, value, isDisabled, onSave }: Props) => {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const problems = replyTemplateProblems({ template: draft });

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const save = (next: string) => {
    if (next === value || replyTemplateProblems({ template: next }).length > 0) {
      return;
    }
    onSave(next);
  };

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-foreground">
        {label}
      </label>
      <Textarea
        id={id}
        value={draft}
        autoGrow
        minRows={3}
        disabled={isDisabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => save(draft)}
        className="font-mono text-xs"
      />
      <div className="flex flex-wrap gap-1">
        {REPLY_TEMPLATE_VARIABLES.map((name) => (
          <button
            key={name}
            type="button"
            disabled={isDisabled}
            onClick={() => {
              const next = `${draft.trimEnd()} {${name}}`;
              setDraft(next);
              save(next);
            }}
            className="rounded-sm bg-subtle px-1.5 font-mono text-2xs leading-5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-50"
          >
            {`{${name}}`}
          </button>
        ))}
      </div>
      {problems.map((problem) => (
        <p key={problem} className="text-2xs text-danger">
          {problem}
        </p>
      ))}
    </div>
  );
};
