import { useState } from 'react';
import { GitCommit } from 'lucide-react';
import { EmptyState, InlineConfirm, Input, cn } from '@goodboy/ui';
import type { BranchCommit } from '@goodboy/types';
import { INSPECTOR_ACTION_CLASS, InspectorSection } from '../InspectorSection';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';

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

export const LocalHistorySection = ({ commits, headSha, onAmend, onSquash }: Props) => {
  const [draft, setDraft] = useState<{ sha: string; mode: Mode; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

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
    <InspectorSection question="What you can still rewrite">
      {commits.length === 0 ? (
        <EmptyState
          icon={CONCEPT_ICONS.commits}
          tone={CONCEPT_TONE.commits}
          title="No commit from this resolver yet"
          size="inline"
        />
      ) : (
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
                  {index === 0 ? (
                    <button
                      type="button"
                      onClick={() => start(commit, 'amend')}
                      disabled={commit.sha !== headSha}
                      title={
                        commit.sha === headSha
                          ? 'Reword the branch HEAD commit'
                          : 'Only the branch HEAD commit can be reworded'
                      }
                      className={INSPECTOR_ACTION_CLASS}
                    >
                      Reword
                    </button>
                  ) : null}
                  {commit.sha !== headSha ? (
                    <button
                      type="button"
                      onClick={() => start(commit, 'squash')}
                      title="Folds every commit from this one through branch HEAD, including later commits not listed here"
                      className={INSPECTOR_ACTION_CLASS}
                    >
                      Squash through HEAD
                    </button>
                  ) : null}
                </div>
              )}
              {draft?.sha === commit.sha ? (
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
                        <button
                          type="button"
                          onClick={() => void submit()}
                          disabled={isBusy || draft.message.trim().length === 0}
                          className={INSPECTOR_ACTION_CLASS}
                        >
                          Save message
                        </button>
                        <button
                          type="button"
                          onClick={() => setDraft(null)}
                          disabled={isBusy}
                          className={INSPECTOR_ACTION_CLASS}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {error === null ? null : <p className="text-2xs text-destructive">{error}</p>}
    </InspectorSection>
  );
};
