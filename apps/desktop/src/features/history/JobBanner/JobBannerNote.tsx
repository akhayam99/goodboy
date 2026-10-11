import { useState } from 'react';
import { Button, useEscapeLayer } from '@goodboy/ui';
import { PromptField } from '../../../shared/components/PromptField';

type SubmitParams = {
  readonly note: string;
};

type Props = {
  readonly isPending: boolean;
  readonly onSubmit: (params: SubmitParams) => void;
  readonly onCollapse: () => void;
};

export const JobBannerNote = ({ isPending, onSubmit, onCollapse }: Props) => {
  const [note, setNote] = useState('');
  useEscapeLayer(onCollapse, true);
  const isEmpty = note.trim() === '';
  const submit = (): void => {
    if (isEmpty) {
      return;
    }
    onSubmit({ note: note.trim() });
  };
  return (
    <PromptField
      kind="document"
      autoFocus
      label="Note for History rewriter"
      placeholder="What should it do differently?"
      value={note}
      onChange={setNote}
      onSubmit={submit}
      minRows={2}
      maxRows={6}
      className="bg-background"
      actions={
        <Button size="sm" isBusy={isPending} disabled={isEmpty} onClick={submit}>
          Retry
        </Button>
      }
    />
  );
};
