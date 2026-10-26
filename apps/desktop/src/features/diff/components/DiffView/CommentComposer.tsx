import { useState } from 'react';
import { tintClasses } from '@goodboy/ui';
import {
  CommentComposer as SharedCommentComposer,
  type CommentComposerBody,
} from '../../../../shared/components/CommentComposer';

type Props = {
  readonly label: string;
  readonly submitLabel: string;
  readonly initialBody?: string;
  readonly onSubmit: (params: CommentComposerBody) => void;
  readonly onCancel: () => void;
  readonly onAskAgent?: (params: CommentComposerBody) => void;
  readonly isBusy?: boolean;
  readonly error?: string | null;
};

const FRAME = `rounded-md border bg-elevated px-3 py-3 font-sans ${tintClasses('primary').border}`;

export const CommentComposer = ({
  label,
  submitLabel,
  initialBody = '',
  onSubmit,
  onCancel,
  onAskAgent,
  isBusy = false,
  error = null,
}: Props) => {
  const [body, setBody] = useState(initialBody);

  return (
    <SharedCommentComposer
      label={label}
      submitLabel={submitLabel}
      value={body}
      onChange={setBody}
      onSubmit={onSubmit}
      onCancel={onCancel}
      onAskAgent={onAskAgent}
      isBusy={isBusy}
      error={error}
      lead={<span className="text-chip text-muted-foreground">{label}</span>}
      className={FRAME}
    />
  );
};
