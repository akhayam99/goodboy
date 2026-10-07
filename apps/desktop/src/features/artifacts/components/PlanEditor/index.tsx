import { Undo2 } from 'lucide-react';
import { Button, InlineConfirm, Notice, Textarea, useEscapeLayer } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { PlanEditorModel } from './usePlanEditor';

type Props = {
  readonly editor: PlanEditorModel;
  readonly title: string;
};

export const PlanEditor = ({ editor, title }: Props) => {
  useEscapeLayer(editor.escape, editor.isEditing);
  if (!editor.isEditing) {
    return null;
  }
  const { conflict, error } = editor;

  return (
    <div data-testid="plan-editor" className="flex min-w-0 flex-col gap-3">
      {editor.isDiscardAsked ? (
        <InlineConfirm
          role="alert"
          icon={<Undo2 size={ICON_SIZE.row} aria-hidden />}
          title="Discard your edit?"
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          onConfirm={editor.discard}
          onCancel={editor.keepEditing}
        />
      ) : null}
      {conflict === null ? null : (
        <Notice
          tone="warning"
          placement="inline"
          role="alert"
          title={`The planner wrote v${conflict.revision} meanwhile`}
          body="Your text is still in the editor."
          actions={
            <span className="flex items-center gap-2">
              <Button variant="secondary" size="xs" onClick={() => void editor.copyDraft()}>
                Copy your text
              </Button>
              <Button variant="ghost" size="xs" onClick={editor.discard}>
                Discard
              </Button>
            </span>
          }
        />
      )}
      {error === null ? null : (
        <span role="alert" className="text-meta text-danger">
          {error}
        </span>
      )}
      <Textarea
        autoFocus
        aria-label={`Edit ${title}`}
        value={editor.draft}
        onChange={(event) => editor.change({ text: event.target.value })}
        className="w-full font-mono text-body"
        autoGrow
        minRows={12}
        maxRows={80}
      />
      <p className="text-meta text-faint-foreground">Markdown. The first line is the plan title.</p>
    </div>
  );
};
