import { useMemo, type KeyboardEvent } from 'react';
import { GitBranch } from 'lucide-react';
import {
  Button,
  EmptyState,
  ErrorStrip,
  Notice,
  ScrollFade,
  SegmentedTabs,
  Skeleton,
} from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { eventMatches } from '../../../../shared/keyboard/dispatcher';
import { SHORTCUTS } from '../../../../shared/keyboard/registry';
import {
  REVIEW_COMMIT_PRESETS,
  type ReviewCommitChoice,
  type ReviewCommitPreset,
} from '../../reviewCommits';
import { PRESET_LABEL, REVIEW_COMMITS_LABEL, branchCommitsLine } from '../../reviewCommitsCopy';
import type { ReviewEntry } from '../ReviewFlow/useReviewEntries';
import { ReviewCommitRow } from './ReviewCommitRow';
import { ReviewCommitsAfter } from './ReviewCommitsAfter';
import { useReviewCommits } from './useReviewCommits';

type Props = {
  readonly sessionId: SessionId;
  readonly entries: ReadonlyArray<ReviewEntry>;
  readonly onOpenThread: (threadId: string) => void;
};

type PresetValue = ReviewCommitPreset | 'custom';

const KEEP: ReviewCommitChoice = { kind: 'keep' };
const SKELETON_ROWS = [0, 1, 2];

export const ReviewCommits = ({ sessionId, entries, onOpenThread }: Props) => {
  const model = useReviewCommits({ sessionId, entries });
  const { rows, choices, after } = model;
  const isLocked = model.isWorking || model.isBusy || model.isDone;
  const foldedAway = useMemo(
    () => new Set(Object.entries(choices).flatMap(([sha, c]) => (c.kind === 'fold' ? [sha] : []))),
    [choices],
  );
  const includedOf = useMemo(() => {
    const byRow = new Map<string, ReadonlyArray<string>>();
    for (const row of rows) {
      const group = after.find((entry) => entry.sha === row.sha);
      const joined = (group?.threads ?? []).filter(
        (thread) => !row.threads.some((own) => own.threadId === thread.threadId),
      );
      byRow.set(
        row.sha,
        [...row.folded, ...joined].flatMap((thread) =>
          thread.author === null ? [] : [thread.author],
        ),
      );
    }
    return byRow;
  }, [after, rows]);

  if (model.mountId === null) {
    return <EmptyState icon={GitBranch} title={REVIEW_COMMITS_LABEL.noBranch} />;
  }
  if (model.draft?.loadError != null) {
    return (
      <ErrorStrip
        label="Couldn't read the branch commits"
        error={new Error(model.draft.loadError)}
        onRetry={model.retry}
      />
    );
  }
  if (model.draft === null) {
    return (
      <div role="status" aria-label={REVIEW_COMMITS_LABEL.loading} className="flex flex-col gap-3">
        {SKELETON_ROWS.map((key) => (
          <Skeleton key={key} className="h-9 w-full max-w-[480px]" />
        ))}
      </div>
    );
  }
  if (rows.length === 0) {
    return <EmptyState icon={GitBranch} title={REVIEW_COMMITS_LABEL.empty} />;
  }

  const hasResolve = rows.some((row) => row.isResolve);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!eventMatches({ event: event.nativeEvent, entry: SHORTCUTS['composer.submit'] })) {
      return;
    }
    event.preventDefault();
    void model.rewrite();
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4" onKeyDown={onKeyDown}>
      {model.isForeign && (
        <Notice
          tone="warning"
          placement="inline"
          title={REVIEW_COMMITS_LABEL.foreignDraft}
          body={REVIEW_COMMITS_LABEL.foreignDraftBody}
          actions={
            <>
              <Button variant="secondary" size="sm" onClick={model.openHistory}>
                {REVIEW_COMMITS_LABEL.openDraft}
              </Button>
              <Button variant="ghost" size="sm" onClick={model.replaceDraft}>
                {REVIEW_COMMITS_LABEL.replaceDraft}
              </Button>
            </>
          }
        />
      )}
      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-4 @4xl:grid-cols-[minmax(0,54fr)_minmax(0,46fr)]">
        <ScrollFade className="min-h-0 min-w-0" viewportClassName="pb-5 pr-2" fadeSize="h-6">
          <div className="flex flex-col gap-3">
            <p className="flex min-w-0 items-center gap-2 text-label text-faint-foreground">
              {model.branch !== null && (
                <span className="truncate font-mono text-muted-foreground">{model.branch}</span>
              )}
              <span className="shrink-0">· {branchCommitsLine({ count: rows.length })}</span>
            </p>
            {hasResolve && (
              <div className="flex flex-wrap items-center gap-2">
                <SegmentedTabs<PresetValue>
                  ariaLabel={REVIEW_COMMITS_LABEL.presets}
                  size="sm"
                  value={model.preset ?? 'custom'}
                  options={REVIEW_COMMIT_PRESETS.map((preset) => ({
                    value: preset,
                    label: PRESET_LABEL[preset],
                    disabled: isLocked,
                  }))}
                  onChange={(value) => {
                    if (value !== 'custom') {
                      model.choosePreset(value);
                    }
                  }}
                />
                {model.preset === null && (
                  <span className="text-secondary text-faint-foreground">
                    {REVIEW_COMMITS_LABEL.custom}
                  </span>
                )}
              </div>
            )}
            <ol aria-label="Branch commits" className="flex flex-col">
              {rows.map((row, index) => (
                <ReviewCommitRow
                  key={row.sha}
                  row={row}
                  earlier={rows.slice(0, index)}
                  choice={choices[row.sha] ?? KEEP}
                  isFoldedAway={foldedAway.has(row.sha)}
                  isDisabled={isLocked}
                  includedAuthors={includedOf.get(row.sha) ?? []}
                  onChoose={(choice) => model.setChoice({ sha: row.sha, choice })}
                  onOpenThread={onOpenThread}
                />
              ))}
            </ol>
          </div>
        </ScrollFade>
        <ScrollFade
          className="min-h-0 min-w-0 rounded-lg bg-subtle"
          viewportClassName="p-4"
          fadeSize="h-6"
        >
          <ReviewCommitsAfter model={model} />
        </ScrollFade>
      </div>
    </div>
  );
};
