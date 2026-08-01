import { useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Copy, Pencil, Play, Square, Trash2 } from 'lucide-react';
import { InlineConfirm, Textarea, cn } from '@goodboy/ui';
import type { WorkspaceScript } from '@goodboy/types';
import { OverflowMenu } from '../../../../shared/components/OverflowMenu';
import type { ScriptRunRecord } from '../../scripts';
import { ScriptRunOutput } from './ScriptRunOutput';
import { SCRIPT_RUN_PRESENTATION } from './scriptRunPresentation';

type Props = {
  readonly script: WorkspaceScript;
  readonly run: ScriptRunRecord | null;
  readonly completedAt: number | undefined;
  readonly expanded: boolean;
  readonly runnable: boolean;
  readonly canRun: boolean;
  readonly copied: boolean;
  readonly onToggle: () => void;
  readonly onSave: (name: string, body: string) => void | Promise<void>;
  readonly onRun: () => void;
  readonly onCancel: () => void;
  readonly onCopy: () => void;
  readonly onDelete: () => void | Promise<void>;
};

type PreviewParams = {
  readonly body: string;
};

type EditField = 'name' | 'body';

type EditParams = {
  readonly field: EditField;
};

const extractPreviewLine = ({ body }: PreviewParams): string => {
  const lines = body.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#!')) {
      continue;
    }
    return trimmed;
  }
  return '';
};

export const ScriptRow = ({
  script,
  run,
  completedAt,
  expanded,
  runnable,
  canRun,
  copied,
  onToggle,
  onSave,
  onRun,
  onCancel,
  onCopy,
  onDelete,
}: Props) => {
  const [editingField, setEditingField] = useState<EditField | null>(null);
  const [nameDraft, setNameDraft] = useState(script.name);
  const [bodyDraft, setBodyDraft] = useState(script.body);
  const [isDeleteArmed, setIsDeleteArmed] = useState(false);
  const status = run?.status ?? 'idle';
  const presentation = SCRIPT_RUN_PRESENTATION[status];
  const preview = extractPreviewLine({ body: script.body });
  const lineCount = script.body.split('\n').length;

  useEffect(() => {
    setNameDraft(script.name);
    setBodyDraft(script.body);
  }, [script.body, script.name]);

  useEffect(() => {
    if (!expanded) {
      setEditingField(null);
    }
  }, [expanded]);

  const startEditing = ({ field }: EditParams) => {
    if (!expanded) {
      onToggle();
    }
    setEditingField(field);
  };

  const commit = ({ field }: EditParams) => {
    const name = nameDraft.trim();
    const body = bodyDraft.trim();
    setEditingField(null);
    const draft = field === 'name' ? name : body;
    const value = field === 'name' ? script.name : script.body;
    if (draft === value) {
      return;
    }
    if (name === '' || body === '') {
      setNameDraft(script.name);
      setBodyDraft(script.body);
      return;
    }
    void onSave(name, body);
  };

  const cancelEditing = ({ field }: EditParams) => {
    if (field === 'name') {
      setNameDraft(script.name);
    }
    if (field === 'body') {
      setBodyDraft(script.body);
    }
    setEditingField(null);
  };

  return (
    <div className="flex flex-col gap-1">
      <div
        data-testid={`script-card-${script.id}`}
        data-status={status}
        className={cn(
          'group flex flex-col gap-2 rounded-md px-2.5 py-2 motion-safe:transition-colors hover:bg-muted/50',
          status !== 'idle' && cn('border', presentation.borderClass),
          presentation.pulseClass,
          expanded && 'bg-muted/20',
        )}
      >
        <div className="flex min-w-0 items-start gap-1.5">
          <button
            type="button"
            onClick={onToggle}
            title={expanded ? 'Collapse script' : 'Expand script'}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${script.name}`}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {expanded ? (
              <ChevronDown size={14} aria-hidden />
            ) : (
              <ChevronRight size={14} aria-hidden />
            )}
          </button>

          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            {editingField === 'name' ? (
              <input
                autoFocus
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                onBlur={() => commit({ field: 'name' })}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    cancelEditing({ field: 'name' });
                  }
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    event.currentTarget.blur();
                  }
                }}
                aria-label="Edit script name"
                className="min-h-7 rounded-md border border-border bg-background px-2 text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (expanded) {
                    startEditing({ field: 'name' });
                    return;
                  }
                  onToggle();
                }}
                className="min-w-0 truncate text-left text-sm font-medium text-foreground"
              >
                {script.name}
              </button>
            )}
            {!expanded && preview !== '' ? (
              <button
                type="button"
                onClick={onToggle}
                className="flex min-w-0 items-center gap-1.5 text-left"
              >
                <span className="min-w-0 truncate font-mono text-2xs text-muted-foreground">
                  {preview}
                </span>
                {lineCount > 1 ? (
                  <span className="shrink-0 text-2xs text-muted-foreground/60">
                    +{lineCount - 1} {lineCount === 2 ? 'line' : 'lines'}
                  </span>
                ) : null}
              </button>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            {runnable ? (
              status === 'pending' ? (
                <button
                  type="button"
                  onClick={onCancel}
                  title="Stop script"
                  aria-label="Stop script"
                  className="flex size-7 items-center justify-center rounded-md text-danger transition-colors hover:bg-danger/10"
                >
                  <Square size={12} fill="currentColor" aria-hidden />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onRun}
                  disabled={!canRun}
                  title="Run script"
                  aria-label="Run script"
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Play size={14} aria-hidden />
                </button>
              )
            ) : null}
            <button
              type="button"
              onClick={onCopy}
              title="Copy script"
              aria-label="Copy script"
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {copied ? (
                <Check size={14} aria-hidden className="text-success" />
              ) : (
                <Copy size={14} aria-hidden />
              )}
            </button>
            <button
              type="button"
              onClick={() => startEditing({ field: 'body' })}
              title="Edit script"
              aria-label="Edit script"
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Pencil size={14} aria-hidden />
            </button>
            <OverflowMenu
              label={`More actions for ${script.name}`}
              triggerClassName="flex size-7 items-center justify-center rounded-md p-0"
              items={[
                {
                  kind: 'item',
                  key: 'delete',
                  label: 'Delete script',
                  icon: Trash2,
                  destructive: true,
                  onClick: () => setIsDeleteArmed(true),
                },
              ]}
            />
          </div>
        </div>

        {expanded ? (
          <div className="flex flex-col gap-2 pl-8">
            {editingField === 'body' ? (
              <Textarea
                autoFocus
                value={bodyDraft}
                onChange={(event) => setBodyDraft(event.target.value)}
                onBlur={() => commit({ field: 'body' })}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    cancelEditing({ field: 'body' });
                  }
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    event.currentTarget.blur();
                  }
                }}
                aria-label={`Edit ${script.name} command`}
                className="font-mono text-xs"
                autoGrow
                minRows={3}
                maxRows={24}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
              />
            ) : (
              <button
                type="button"
                onClick={() => startEditing({ field: 'body' })}
                className="cursor-text rounded-lg bg-subtle/40 p-3 text-left transition-colors hover:bg-subtle/70"
              >
                <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground/80">
                  {bodyDraft}
                </pre>
              </button>
            )}
            {run !== null ? <ScriptRunOutput run={run} completedAt={completedAt} /> : null}
          </div>
        ) : null}
      </div>

      {isDeleteArmed ? (
        <InlineConfirm
          role="danger"
          icon={<Trash2 size={12} aria-hidden />}
          title={`Delete "${script.name}"?`}
          description="Permanently removes this script from the workspace."
          confirmLabel={`Delete ${script.name}`}
          autoDisarmMs={4000}
          onConfirm={async () => {
            await onDelete();
            setIsDeleteArmed(false);
          }}
          onCancel={() => setIsDeleteArmed(false)}
        />
      ) : null}
    </div>
  );
};
