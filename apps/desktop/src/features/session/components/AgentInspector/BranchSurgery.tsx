import { useState } from 'react';
import { Check, GitCommit, GitMerge, Pencil, X } from 'lucide-react';
import { InlineConfirm, Input, cn } from '@goodboy/ui';
import type { BranchCommit } from '@goodboy/types';
import { GhostActionButton } from '../../../../shared/components/GhostActionButton';

type Mode = 'amend' | 'squash';

type Props = {
  readonly commits: ReadonlyArray<BranchCommit>;
  readonly headSha: string | null;
  readonly onAmend: (sha: string, message: string) => Promise<void>;
  readonly onSquash: (sha: string, message: string) => Promise<void>;
};

const PROMPT: Record<Mode, string> = {
  amend: 'new message for this commit',
  squash: 'message for the squashed commit',
};

export const BranchSurgery = ({ commits, headSha, onAmend, onSquash }: Props) => {
  const [draft, setDraft] = useState<{ sha: string; mode: Mode; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  if (commits.length === 0) {
    return null;
  }

  const start = (commit: BranchCommit, mode: Mode) => {
    setError(null);
    setDraft({ sha: commit.sha, mode, message: commit.subject });
  };

  const submit = async () => {
    if (draft === null || draft.message.trim().length === 0) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const apply = draft.mode === 'amend' ? onAmend : onSquash;
      await apply(draft.sha, draft.message);
      setDraft(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 px-2.5 py-1.5">
      <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground/70">
        Rewrite the branch
      </span>
      <ul className="flex flex-col gap-1.5">
        {commits.map((commit, index) => (
          <li key={commit.sha} className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 items-baseline gap-2">
              <GitCommit size={11} aria-hidden className="shrink-0 text-muted-foreground/60" />
              <span className="shrink-0 font-mono text-2xs tabular-nums text-muted-foreground/80">
                {commit.shortSha}
              </span>
              <span
                className={cn(
                  'truncate text-2xs',
                  commit.pushed ? 'text-muted-foreground/60' : 'text-foreground/80',
                )}
                title={commit.subject}
              >
                {commit.subject}
              </span>
            </div>
            {commit.pushed ? (
              <span
                className="pl-5 text-2xs italic text-muted-foreground/60"
                title="rewriting it would need a force push"
              >
                already pushed
              </span>
            ) : (
              <div className="flex flex-wrap items-center gap-1 pl-5">
                {index === 0 && (
                  <GhostActionButton
                    icon={Pencil}
                    label="Reword"
                    disabled={commit.sha !== headSha}
                    onClick={() => start(commit, 'amend')}
                  />
                )}
                {commit.sha !== headSha && (
                  <GhostActionButton
                    icon={GitMerge}
                    label="Squash through HEAD"
                    onClick={() => start(commit, 'squash')}
                  />
                )}
              </div>
            )}
            {draft?.sha === commit.sha && (
              <div className="flex flex-col gap-1 pl-5">
                {draft.mode === 'squash' ? (
                  <InlineConfirm
                    role="danger"
                    icon={<GitCommit size={12} aria-hidden />}
                    title="Squash every commit through HEAD?"
                    description="This rewrites history by folding every commit from the selected one through branch HEAD into one, including later commits not listed here."
                    confirmLabel="Squash into one"
                    isBusy={isBusy}
                    isConfirmDisabled={draft.message.trim().length === 0}
                    note={
                      <Input
                        value={draft.message}
                        onChange={(event) => setDraft({ ...draft, message: event.target.value })}
                        placeholder={PROMPT.squash}
                        aria-label={PROMPT.squash}
                        className="h-7 text-xs"
                      />
                    }
                    onConfirm={submit}
                    onCancel={() => setDraft(null)}
                  />
                ) : (
                  <>
                    <Input
                      value={draft.message}
                      onChange={(event) => setDraft({ ...draft, message: event.target.value })}
                      placeholder={PROMPT.amend}
                      aria-label={PROMPT.amend}
                      className="h-7 text-xs"
                    />
                    <div className="flex items-center gap-1">
                      <GhostActionButton
                        icon={Check}
                        label="Save message"
                        disabled={isBusy || draft.message.trim().length === 0}
                        onClick={() => void submit()}
                      />
                      <GhostActionButton
                        icon={X}
                        label="Cancel"
                        disabled={isBusy}
                        onClick={() => setDraft(null)}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {error !== null && <p className="text-2xs text-destructive">{error}</p>}
    </div>
  );
};
