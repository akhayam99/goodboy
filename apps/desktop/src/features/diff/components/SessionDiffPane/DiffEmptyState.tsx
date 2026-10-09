import type { ReactNode } from 'react';
import { Button, EmptyState, PageColumn } from '@goodboy/ui';
import type { DiffView } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import type { DiffAlternate } from '../../hooks/useSessionDiff';

type Props = {
  readonly view: DiffView;
  readonly baseBranch: string | null;
  readonly alternate: DiffAlternate | null;
  readonly onChange: (view: DiffView) => void;
  readonly selector: ReactNode;
};

const baseWord = (baseBranch: string | null): string => baseBranch ?? 'its base branch';

const filesWord = (count: number): string => `${count} ${count === 1 ? 'file' : 'files'}`;

const titleOf = ({ view, baseBranch, alternate }: Omit<Props, 'onChange' | 'selector'>): string => {
  if (view.kind === 'commit') {
    return 'This commit is empty';
  }
  if (view.kind === 'branch') {
    return `Branch matches ${baseWord(baseBranch)}`;
  }
  if (view.scope === 'staged') {
    return 'No staged changes';
  }
  if (view.scope === 'unstaged') {
    return 'No unstaged changes';
  }
  return alternate === null ? 'No changes on this branch yet' : 'Working tree clean';
};

const blurbOf = ({ view, baseBranch, alternate }: Omit<Props, 'onChange' | 'selector'>): string => {
  if (view.kind === 'commit') {
    return 'No file changes were recorded for this commit.';
  }
  if (view.kind === 'branch') {
    return alternate === null
      ? `Every commit on this branch is already reachable from ${baseWord(baseBranch)}, nothing extra to review.`
      : `No commits differ from ${baseWord(baseBranch)}, but the working tree has edits.`;
  }
  if (view.scope === 'staged') {
    return 'Nothing has been staged for the next commit yet.';
  }
  if (view.scope === 'unstaged') {
    return 'No uncommitted edits in the working tree.';
  }
  return alternate === null
    ? 'No uncommitted edits, and no commits ahead of its base branch.'
    : `Nothing uncommitted. This branch changes ${filesWord(alternate.fileCount)} against ${baseWord(baseBranch)}.`;
};

const switchLabelOf = ({
  alternate,
  baseBranch,
}: Pick<Props, 'alternate' | 'baseBranch'>): string | null => {
  if (alternate === null) {
    return null;
  }
  const count = filesWord(alternate.fileCount);
  return alternate.view.kind === 'branch'
    ? `Show branch vs ${baseWord(baseBranch)} (${count})`
    : `Show working tree (${count})`;
};

export const DiffEmptyState = ({ view, baseBranch, alternate, onChange, selector }: Props) => {
  const switchLabel = switchLabelOf({ alternate, baseBranch });
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center pb-12">
      <PageColumn>
        <EmptyState
          size="section"
          tone={CONCEPT_TONE.diff}
          icon={CONCEPT_ICONS.diff}
          title={titleOf({ view, baseBranch, alternate })}
          description={blurbOf({ view, baseBranch, alternate })}
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              {alternate === null || switchLabel === null ? null : (
                <Button size="sm" variant="secondary" onClick={() => onChange(alternate.view)}>
                  {switchLabel}
                </Button>
              )}
              {selector}
            </div>
          }
        />
      </PageColumn>
    </div>
  );
};
