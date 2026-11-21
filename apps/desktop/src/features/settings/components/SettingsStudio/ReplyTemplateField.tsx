import { useId, type ReactNode } from 'react';
import { FieldError, Textarea, cn } from '@goodboy/ui';
import { replyTemplateProblems } from '../../../resolve/renderReplyTemplate';
import type { SettingSave } from '../../hooks/useSettingSave';
import { useSettingRowAnchor } from '../../hooks/useSettingRowAnchor';
import { SaveErrorHelp } from './SaveErrorHelp';

export type ReplyTemplateCommit = {
  readonly caret: number;
};

type Props = {
  readonly label: string;
  readonly rowKey: string;
  readonly draft: string;
  readonly isDisabled: boolean;
  readonly save: Pick<SettingSave<unknown>, 'error' | 'isSaving' | 'retry'>;
  readonly onDraftChange: (next: string) => void;
  readonly onCommit: (commit: ReplyTemplateCommit) => void;
  readonly action?: ReactNode;
  readonly children?: ReactNode;
};

export const ReplyTemplateField = ({
  label,
  rowKey,
  draft,
  isDisabled,
  save,
  onDraftChange,
  onCommit,
  action,
  children,
}: Props) => {
  const id = useId();
  const anchor = useSettingRowAnchor({ rowKey });
  const problemId = useId();
  const saveErrorId = useId();
  const problems = replyTemplateProblems({ template: draft });
  const hasSaveError = save.error !== null;
  const describedBy = [problems.length > 0 ? problemId : null, hasSaveError ? saveErrorId : null]
    .filter((part) => part !== null)
    .join(' ');
  const problemText =
    problems.length === 0
      ? null
      : problems.map((problem) => (
          <span key={problem} className="block">
            {problem}
          </span>
        ));

  return (
    <div
      ref={anchor.ref}
      data-anchor={rowKey}
      data-highlighted={anchor.isHighlighted ? '' : undefined}
      className={cn(
        'flex min-w-0 flex-col gap-2 rounded-sm transition-colors duration-500',
        anchor.isHighlighted && 'bg-selected',
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <label htmlFor={id} className="text-meta font-medium text-foreground">
          {label}
        </label>
        {action}
      </div>
      <Textarea
        id={id}
        value={draft}
        autoGrow
        minRows={3}
        disabled={isDisabled}
        onChange={(event) => onDraftChange(event.target.value)}
        onBlur={(event) => onCommit({ caret: event.currentTarget.selectionStart })}
        className="text-code"
        aria-invalid={describedBy === '' ? undefined : true}
        aria-describedby={describedBy === '' ? undefined : describedBy}
      />
      <FieldError id={problemId} error={problemText} />
      {hasSaveError ? <SaveErrorHelp id={saveErrorId} save={save} /> : null}
      {children}
    </div>
  );
};
