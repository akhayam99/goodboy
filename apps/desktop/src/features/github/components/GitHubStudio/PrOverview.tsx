import { useEffect, useState, type ClipboardEvent, type MouseEvent } from 'react';
import type { PullRequestState, SessionId } from '@goodboy/types';
import { cn, Markdown, SectionHeader, Textarea } from '@goodboy/ui';
import { Check, ImagePlus, Loader2, Pencil, X } from 'lucide-react';
import { useAppStore } from '../../../../store';
import { formatError } from '../../../../shared/lib/errors';

type Props = {
  readonly pr: PullRequestState;
  readonly sessionId: SessionId;
  readonly onMutated: () => void;
};

type Editing = 'title' | 'body' | null;

const IMG_URL_RE =
  /^https?:\/\/\S+(?:\.(?:png|jpe?g|gif|webp|svg)(?:\?\S*)?|\/user-attachments\/\S+|githubusercontent\.com\/\S+)$/i;

export function PrOverview({ pr, sessionId, onMutated }: Props) {
  const editPr = useAppStore((s) => s.editPr);
  const [editing, setEditing] = useState<Editing>(null);
  const [titleDraft, setTitleDraft] = useState(pr.title);
  const [bodyDraft, setBodyDraft] = useState(pr.body);
  const [busy, setBusy] = useState<Editing>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEditing(null);
    setTitleDraft(pr.title);
    setBodyDraft(pr.body);
    setError(null);
  }, [pr.number, pr.title, pr.body]);

  const save = async (field: 'title' | 'body') => {
    if (busy) return;
    setBusy(field);
    setError(null);
    try {
      await editPr(
        sessionId,
        pr.number,
        field === 'title' ? { title: titleDraft } : { body: bodyDraft },
      );
      setEditing(null);
      onMutated();
    } catch (e) {
      setError(formatError(e));
    } finally {
      setBusy(null);
    }
  };

  const cancel = () => {
    setTitleDraft(pr.title);
    setBodyDraft(pr.body);
    setEditing(null);
    setError(null);
  };

  const onPasteBody = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text').trim();
    if (!IMG_URL_RE.test(text)) return;
    e.preventDefault();
    const el = e.currentTarget;
    const start = el.selectionStart ?? bodyDraft.length;
    const end = el.selectionEnd ?? bodyDraft.length;
    setBodyDraft(bodyDraft.slice(0, start) + `![](${text})` + bodyDraft.slice(end));
  };

  const onDescClick = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('a, img, button')) return;
    setEditing('body');
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-8 py-6">
      <div className="flex flex-col gap-1">
        {editing === 'title' ? (
          <div className="flex items-center gap-2">
            <input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void save('title');
                if (e.key === 'Escape') cancel();
              }}
              autoFocus
              className="w-full rounded-md border border-border-soft bg-background px-2.5 py-1.5 text-xl font-semibold text-foreground outline-none focus:border-primary"
            />
            <SaveCancel
              busy={busy === 'title'}
              onSave={() => void save('title')}
              onCancel={cancel}
            />
          </div>
        ) : (
          <div className="group flex items-start gap-2">
            <h1 className="flex-1 text-2xl font-semibold leading-tight text-foreground">
              {pr.title} <span className="font-normal text-muted-foreground/50">#{pr.number}</span>
            </h1>
            <button
              type="button"
              onClick={() => setEditing('title')}
              title="edit title"
              aria-label="edit title"
              className="mt-1 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
            >
              <Pencil size={14} aria-hidden />
            </button>
          </div>
        )}
        <p className="font-mono text-2xs text-muted-foreground/70">
          {pr.headBranch} → {pr.baseBranch}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <SectionHeader
          label="Description"
          action={
            editing === 'body' ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60">
                <ImagePlus size={11} aria-hidden />
                paste an image url to embed it
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setEditing('body')}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Pencil size={11} aria-hidden />
                Edit
              </button>
            )
          }
        />

        {editing === 'body' ? (
          <div className="flex flex-col gap-2">
            <Textarea
              value={bodyDraft}
              onChange={(e) => setBodyDraft(e.target.value)}
              onPaste={onPasteBody}
              placeholder="describe what changed and why (markdown + images supported)"
              className="text-sm"
              autoGrow
              maxRows={24}
              autoFocus
            />
            <div className="flex items-center gap-2">
              <SaveCancel
                busy={busy === 'body'}
                onSave={() => void save('body')}
                onCancel={cancel}
              />
            </div>
          </div>
        ) : pr.body.trim() ? (
          <div
            onClick={onDescClick}
            className="cursor-text rounded-md border border-transparent px-3 py-2 transition-colors hover:border-border-soft hover:bg-muted/20"
          >
            <Markdown text={pr.body} className="text-sm leading-relaxed" />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing('body')}
            className="rounded-md border border-dashed border-border-soft px-3 py-4 text-left text-sm text-muted-foreground/60 transition-colors hover:border-border hover:text-muted-foreground"
          >
            No description yet. Click to add one.
          </button>
        )}

        {error ? <p className="text-xs text-danger">{error}</p> : null}
      </div>
    </div>
  );
}

function SaveCancel({
  busy,
  onSave,
  onCancel,
}: {
  busy: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={onSave}
        disabled={busy}
        title="save"
        aria-label="save"
        className={cn(
          'inline-flex items-center justify-center rounded-md bg-primary p-1.5 text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50',
        )}
      >
        {busy ? (
          <Loader2 size={14} aria-hidden className="animate-spin" />
        ) : (
          <Check size={14} aria-hidden />
        )}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        title="cancel"
        aria-label="cancel"
        className="inline-flex items-center justify-center rounded-md border border-border-soft p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}
