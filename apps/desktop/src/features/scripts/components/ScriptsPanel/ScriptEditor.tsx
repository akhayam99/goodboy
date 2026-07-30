import { useMemo, useRef } from 'react';
import { Button, Divider, Input } from '@goodboy/ui';
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
  const gutterRef = useRef<HTMLDivElement>(null);

  const lineCount = useMemo(() => {
    const raw = draft.body.split('\n').length;
    return Math.max(raw, 1);
  }, [draft.body]);

  const lines = useMemo(
    () => Array.from({ length: lineCount }, (_, index) => index + 1),
    [lineCount],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
      <Input
        value={draft.name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Script name (e.g. copy environments)"
        autoFocus
      />
      <div className="flex min-h-[200px] flex-1 overflow-hidden rounded-lg border border-border bg-subtle/40 font-mono text-xs leading-relaxed">
        <div
          ref={gutterRef}
          aria-hidden
          className="shrink-0 select-none overflow-hidden py-2 pl-2 pr-2 text-right text-muted-foreground/60"
        >
          {lines.map((line) => (
            <div key={line} className="tabular-nums">
              {line}
            </div>
          ))}
        </div>
        <textarea
          value={draft.body}
          onChange={(e) => onBodyChange(e.target.value)}
          onScroll={(e) => {
            const gutter = gutterRef.current;
            if (gutter === null) {
              return;
            }
            gutter.scrollTop = e.currentTarget.scrollTop;
          }}
          placeholder={'#!/bin/bash\ncp ../main/.env .env'}
          className="min-w-0 flex-1 resize-none bg-transparent px-2 py-2 leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/50"
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          wrap="off"
        />
      </div>
      {error !== null ? <p className="text-xs text-danger">{error}</p> : null}
      <div className="sticky bottom-0 flex shrink-0 items-center justify-end gap-1.5 bg-background pt-2">
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
