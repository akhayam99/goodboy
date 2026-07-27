import { useEffect } from 'react';
import { Button, Divider, Input, Textarea } from '@goodboy/ui';
import { Check } from 'lucide-react';
import type { ScriptRunRecord } from '../../scripts';
import { ScriptRunOutput } from './ScriptRunOutput';
import type { Draft } from './types';

type Props = {
  readonly draft: Draft;
  readonly dirty: boolean;
  readonly error: string | null;
  readonly run: ScriptRunRecord | null;
  readonly completedAt: number | undefined;
  readonly onNameChange: (value: string) => void;
  readonly onBodyChange: (value: string) => void;
  readonly onSave: () => void;
  readonly onCancel: () => void;
};

export const ScriptEditor = ({
  draft,
  dirty,
  error,
  run,
  completedAt,
  onNameChange,
  onBodyChange,
  onSave,
  onCancel,
}: Props) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      <Input
        value={draft.name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Script name (e.g. copy environments)"
        autoFocus
      />
      <Textarea
        value={draft.body}
        onChange={(e) => onBodyChange(e.target.value)}
        placeholder={'#!/bin/bash\ncp ../main/.env .env'}
        className="min-h-[200px] flex-1 resize-none font-mono text-xs"
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
      />
      {error !== null ? <p className="text-xs text-danger">{error}</p> : null}
      <div className="flex items-center justify-end gap-1.5">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={onSave} disabled={!dirty}>
          <Check size={13} aria-hidden />
          Save
        </Button>
      </div>
      {run !== null ? (
        <>
          <Divider />
          <ScriptRunOutput run={run} completedAt={completedAt} />
        </>
      ) : null}
    </div>
  );
};
