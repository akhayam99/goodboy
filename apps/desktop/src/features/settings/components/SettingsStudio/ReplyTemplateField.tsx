import { useId } from 'react';
import { Textarea } from '@goodboy/ui';
import { replyTemplateProblems } from '../../../resolve/renderReplyTemplate';

type Props = {
  readonly label: string;
  readonly draft: string;
  readonly isDisabled: boolean;
  readonly onDraftChange: (next: string) => void;
  readonly onFocus: () => void;
  readonly onCommit: () => void;
};

export const ReplyTemplateField = ({
  label,
  draft,
  isDisabled,
  onDraftChange,
  onFocus,
  onCommit,
}: Props) => {
  const id = useId();
  const problems = replyTemplateProblems({ template: draft });

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="text-meta font-medium text-foreground">
        {label}
      </label>
      <Textarea
        id={id}
        value={draft}
        autoGrow
        minRows={3}
        disabled={isDisabled}
        onChange={(event) => onDraftChange(event.target.value)}
        onFocus={onFocus}
        onBlur={onCommit}
        className="text-code"
      />
      {problems.map((problem) => (
        <p key={problem} className="text-meta text-danger">
          {problem}
        </p>
      ))}
    </div>
  );
};
