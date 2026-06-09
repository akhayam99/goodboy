import { useEffect, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { Dialog, Textarea, cn } from '@goodboy/ui';
import { Loader2, Sparkles } from 'lucide-react';
import { ghBaseBranches } from '../../github';
import { AGENT_KIND_DEFAULTS } from '../../../session/agent-kind';
import { useAppStore } from '../../../../store';

type Props = {
  readonly sessionId: SessionId;
  readonly defaultTitle: string;
  readonly closedPr?: { number: number; url: string };
  readonly onClose: () => void;
  readonly onStudioClose: () => void;
};

const FIELD =
  'w-full rounded-md border border-border-soft bg-background px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-primary' as const;

export function CreatePrDialog({
  sessionId,
  defaultTitle,
  closedPr,
  onClose,
  onStudioClose,
}: Props) {
  const createPrForSession = useAppStore((s) => s.createPrForSession);
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
  const workspaceRoot = useAppStore((s) => {
    const sess = s.sessions.find((x) => x.id === sessionId);
    const ws = sess ? s.workspaces.find((w) => w.id === sess.workspaceId) : undefined;
    return ws?.rootPath ?? null;
  });
  const workspaceId = useAppStore((s) => s.sessions.find((x) => x.id === sessionId)?.workspaceId);

  const [title, setTitle] = useState(defaultTitle);
  const [body, setBody] = useState('');
  const [base, setBase] = useState('');
  const [branches, setBranches] = useState<ReadonlyArray<string>>([]);
  const [draft, setDraft] = useState(true);
  const [busy, setBusy] = useState<'create' | 'ai' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceRoot) return;
    let cancelled = false;
    void ghBaseBranches(workspaceRoot, workspaceId).then(({ defaultBranch, branches: list }) => {
      if (cancelled) return;
      setBranches(list);
      if (defaultBranch) setBase((cur) => (cur.trim() === '' ? defaultBranch : cur));
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceRoot, workspaceId]);

  const onCreate = async () => {
    if (busy) return;
    setBusy('create');
    setError(null);
    try {
      await createPrForSession(sessionId, { title, body, base, draft });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const onCreateWithAi = async () => {
    if (busy) return;
    setBusy('ai');
    setError(null);
    try {
      const prompt = [
        `Open a GitHub pull request for this session's branch.`,
        ...(closedPr
          ? [
              `- IMPORTANT: a previous PR #${closedPr.number} (${closedPr.url}) on this branch was CLOSED on purpose. Open a brand new pull request. Do NOT reopen #${closedPr.number}, and do not be confused if you find that closed PR while checking.`,
            ]
          : []),
        `- Write a clear, conventional title and a concise description from the committed changes.`,
        `- Session goal: "${defaultTitle}".`,
        `- If this project defines a PR-creation skill, command, or template (look under .claude/), follow it.`,
        `- Open it as a ${draft ? 'draft' : 'ready-for-review'} PR.`,
        `Then run \`gh pr create\` to open it and report the PR URL.`,
      ].join('\n');
      const agentId = await spawnAgent(sessionId, {
        name: 'open pull request',
        initialPrompt: prompt,
        model: AGENT_KIND_DEFAULTS.generic.model,
        effort: AGENT_KIND_DEFAULTS.generic.effort,
      });
      await selectAgent(sessionId, agentId);
      await setCurrentSession(sessionId);
      onClose();
      onStudioClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(null);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Open a pull request"
      size="lg"
      footer={
        <div className="flex w-full items-center gap-2">
          {error ? (
            <span className="mr-auto min-w-0 flex-1 truncate text-xs text-danger" title={error}>
              {error}
            </span>
          ) : (
            <span className="mr-auto" />
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onCreateWithAi()}
            disabled={busy !== null}
            title="hand it to an agent: it drafts the title and description, then opens the PR"
            className="inline-flex items-center gap-1.5 rounded-md border border-accent/30 bg-accent/5 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/15 disabled:opacity-50"
          >
            {busy === 'ai' ? (
              <Loader2 size={13} aria-hidden className="animate-spin" />
            ) : (
              <Sparkles size={13} aria-hidden />
            )}
            Draft with an agent
          </button>
          <button
            type="button"
            onClick={() => void onCreate()}
            disabled={busy !== null || title.trim().length === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {busy === 'create' ? <Loader2 size={13} aria-hidden className="animate-spin" /> : null}
            Create PR
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            Title
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="pull request title"
            className={FIELD}
            autoFocus
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            Description
          </span>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="what changed and why (markdown supported)"
            className="text-sm"
            autoGrow
            maxRows={12}
          />
        </label>
        <div className="flex items-end gap-3">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              Base branch
            </span>
            <input
              value={base}
              onChange={(e) => setBase(e.target.value)}
              placeholder="default branch"
              className={FIELD}
              list="pr-base-branches"
            />
            <datalist id="pr-base-branches">
              {branches.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </label>
          <button
            type="button"
            onClick={() => setDraft((d) => !d)}
            aria-pressed={draft}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
              draft
                ? 'border-warning/40 bg-warning/10 text-warning'
                : 'border-border-soft text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
            title="open the PR as a draft"
          >
            <span
              aria-hidden
              className={cn(
                'size-3 rounded-sm border',
                draft ? 'border-warning bg-warning' : 'border-border',
              )}
            />
            Draft
          </button>
        </div>
      </div>
    </Dialog>
  );
}
