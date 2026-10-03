import { GitCommitHorizontal, GitMerge } from 'lucide-react';
import { Button, Eyebrow, FormActions, KbdPill, Notice, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { REVIEW_COMMITS_LABEL, commitCountLabel, rewriteNote } from '../../reviewCommitsCopy';
import { ReviewCommitsCheck } from './ReviewCommitsCheck';
import { ReviewCommitsDone } from './ReviewCommitsDone';
import { ReviewCommitsProgress } from './ReviewCommitsProgress';
import { ReviewCommitsReplies } from './ReviewCommitsReplies';
import type { ReviewCommitsModel } from './useReviewCommits';

type Props = {
  readonly model: ReviewCommitsModel;
};

const SHORT = 7;

const shortOf = (sha: string): string => sha.slice(0, SHORT);

export const ReviewCommitsAfter = ({ model }: Props) => {
  const stop = model.run?.phase === 'stopped' ? model.run.stop : null;
  if (model.isDone) {
    return <ReviewCommitsDone model={model} />;
  }
  return (
    <div className="flex flex-col gap-3">
      {model.run?.phase === 'restored' && (
        <p role="status" className="text-label text-muted-foreground">
          {REVIEW_COMMITS_LABEL.restored}
        </p>
      )}
      <div className="flex h-6 items-center gap-2">
        <Eyebrow label={REVIEW_COMMITS_LABEL.after} muted />
        <span className="text-label text-faint-foreground">
          {commitCountLabel({ count: model.after.length })}
          {model.hasChange ? '' : `, ${REVIEW_COMMITS_LABEL.noChange}`}
        </span>
      </div>
      <ol className="flex flex-col gap-px rounded-lg border border-border-soft bg-background p-1">
        {model.after.map((entry) => {
          const Icon = entry.members.length > 1 ? GitMerge : GitCommitHorizontal;
          const sha = entry.newSha === null ? null : shortOf(entry.newSha);
          return (
            <li
              key={entry.sha}
              className="grid list-none grid-cols-[18px_minmax(0,1fr)] items-center gap-x-2 rounded-md px-2 py-1"
            >
              <Icon
                size={ICON_SIZE.control}
                className={cn(
                  'row-span-2 self-center',
                  entry.isChanged ? 'text-primary' : 'text-faint-foreground',
                )}
                aria-hidden
              />
              <span className="flex min-w-0 items-baseline gap-2 text-label">
                <span
                  className={cn(
                    'shrink-0 font-mono',
                    entry.isChanged ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {sha ?? 'new'}
                </span>
                <span className="min-w-0 truncate text-foreground">{entry.subject}</span>
              </span>
              {entry.isChanged && (
                <span className="col-start-2 truncate font-mono text-secondary text-faint-foreground">
                  {entry.members.length > 1
                    ? entry.members.join(' + ')
                    : `rebased from ${entry.members[0] ?? shortOf(entry.sha)}`}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <ReviewCommitsCheck model={model} />
      <ReviewCommitsReplies model={model} />
      {stop !== null && (
        <Notice
          tone="danger"
          placement="inline"
          title="Nothing was rewritten"
          body={stop.message}
        />
      )}
      <p className="text-secondary text-faint-foreground">
        {rewriteNote({ hasChange: model.hasChange, replaced: model.replaced })}
      </p>
      {model.isWorking ? (
        <ReviewCommitsProgress model={model} />
      ) : (
        <FormActions error={model.error}>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={!model.hasChange}
            onClick={model.reset}
          >
            {REVIEW_COMMITS_LABEL.reset}
          </Button>
          <Button size="sm" disabled={!model.canRewrite} onClick={() => void model.rewrite()}>
            {model.replaced > 0
              ? REVIEW_COMMITS_LABEL.rewriteAndPush
              : REVIEW_COMMITS_LABEL.rewrite}
            <KbdPill className="border-transparent bg-transparent text-current">
              {shortcutGlyphs('composer.submit')}
            </KbdPill>
          </Button>
        </FormActions>
      )}
    </div>
  );
};
