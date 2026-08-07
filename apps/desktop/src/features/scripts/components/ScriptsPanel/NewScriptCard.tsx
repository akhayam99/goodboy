import { AlertTriangle } from 'lucide-react';
import { Button, Divider, FieldRow, Input, Textarea } from '@goodboy/ui';

type Props = {
  readonly name: string;
  readonly body: string;
  readonly error: string | null;
  readonly onNameChange: (value: string) => void;
  readonly onBodyChange: (value: string) => void;
  readonly onSave: () => void;
  readonly onCancel: () => void;
};

export const NewScriptCard = ({
  name,
  body,
  error,
  onNameChange,
  onBodyChange,
  onSave,
  onCancel,
}: Props) => (
  <section className="flex flex-col gap-6">
    <section className="flex flex-col">
      <FieldRow label="Name">
        <Input
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Script name (e.g. copy environments)"
          autoFocus
          className="w-full sm:w-72"
        />
      </FieldRow>
      <Divider />
      <FieldRow label="Command" help="Runs from the session worktree.">
        <Textarea
          value={body}
          onChange={(event) => onBodyChange(event.target.value)}
          placeholder={'#!/bin/bash\ncp ../main/.env .env'}
          className="w-full font-mono text-xs sm:w-96"
          autoGrow
          minRows={5}
          maxRows={24}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
        />
      </FieldRow>
    </section>
    <Divider />
    <footer className="flex shrink-0 items-center gap-3">
      <div className="min-w-0 flex-1">
        {error !== null ? (
          <span role="alert" className="inline-flex items-center gap-1 text-xs text-danger">
            <AlertTriangle size={12} aria-hidden />
            {error}
          </span>
        ) : null}
      </div>
      <Button variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
      <Button size="sm" onClick={onSave}>
        Save
      </Button>
    </footer>
  </section>
);
