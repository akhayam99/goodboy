import { Check, X } from 'lucide-react';
import { Button, Input, Textarea } from '@goodboy/ui';

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
  <div className="flex flex-col gap-3 rounded-lg border border-info/40 bg-info/[0.03] p-3">
    <Input
      value={name}
      onChange={(event) => onNameChange(event.target.value)}
      placeholder="Script name (e.g. copy environments)"
      autoFocus
    />
    <Textarea
      value={body}
      onChange={(event) => onBodyChange(event.target.value)}
      placeholder={'#!/bin/bash\ncp ../main/.env .env'}
      className="font-mono text-xs"
      autoGrow
      minRows={5}
      maxRows={24}
      spellCheck={false}
      autoCorrect="off"
      autoCapitalize="off"
    />
    {error !== null ? <p className="text-xs text-danger">{error}</p> : null}
    <div className="flex items-center justify-end gap-1.5">
      <Button variant="ghost" size="sm" onClick={onCancel}>
        <X size={13} aria-hidden />
        Cancel
      </Button>
      <Button size="sm" onClick={onSave}>
        <Check size={13} aria-hidden />
        Save
      </Button>
    </div>
  </div>
);
