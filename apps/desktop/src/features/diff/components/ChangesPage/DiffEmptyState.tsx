import { Button, EmptyState } from '@goodboy/ui';
import type { DiffView } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import type { DiffAlternate } from '../../hooks/useSessionDiff';
import { countNoun } from '../../../../shared/utils/countNoun';

type Props = {
  readonly view: DiffView;
  readonly baseBranch: string | null;
  readonly alternate: DiffAlternate | null;
  readonly onChange: (view: DiffView) => void;
  readonly onShowAllFiles?: () => void;
};

type CopyParams = {
  readonly view: DiffView;
  readonly baseBranch: string | null;
  readonly alternate: DiffAlternate | null;
};

type BaseParams = {
  readonly baseBranch: string | null;
};

type CountParams = {
  readonly count: number;
};

type SwitchParams = {
  readonly alternate: DiffAlternate | null;
  readonly baseBranch: string | null;
};

const baseWord = ({ baseBranch }: BaseParams): string => baseBranch ?? 'its base branch';

const filesWord = ({ count }: CountParams): string => countNoun({ count, one: 'file' });

const titleOf = ({ view, baseBranch, alternate }: CopyParams): string => {
  if (view.kind === 'commit') {
    return 'This commit is empty';
  }
  if (view.kind === 'branch') {
    return `Branch matches ${baseWord({ baseBranch })}`;
  }
  if (view.scope === 'staged') {
    return 'No staged changes';
  }
  if (view.scope === 'unstaged') {
    return 'No unstaged changes';
  }
  return alternate === null ? 'No changes on this branch yet' : 'Working tree clean';
};

const blurbOf = ({ view, baseBranch, alternate }: CopyParams): string => {
  const base = baseWord({ baseBranch });
  if (view.kind === 'commit') {
    return 'No file changes were recorded for this commit.';
  }
  if (view.kind === 'branch') {
    return alternate === null
      ? `Every commit on this branch is already reachable from ${base}, nothing extra to review.`
      : `No commits differ from ${base}, but the working tree has edits.`;
  }
  if (view.scope === 'staged') {
    return 'Nothing has been staged for the next commit yet.';
  }
  if (view.scope === 'unstaged') {
    return 'No uncommitted edits in the working tree.';
  }
  return alternate === null
    ? 'No uncommitted edits, and no commits ahead of its base branch.'
    : `Nothing uncommitted. This branch changes ${filesWord({ count: alternate.fileCount })} against ${base}.`;
};

const switchLabelOf = ({ alternate, baseBranch }: SwitchParams): string | null => {
  if (alternate === null) {
    return null;
  }
  const count = filesWord({ count: alternate.fileCount });
  return alternate.view.kind === 'branch'
    ? `Show branch vs ${baseWord({ baseBranch })} (${count})`
    : `Show working tree (${count})`;
};

export const DiffEmptyState = ({
  view,
  baseBranch,
  alternate,
  onChange,
  onShowAllFiles,
}: Props) => {
  const switchLabel = switchLabelOf({ alternate, baseBranch });
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-12">
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
            {onShowAllFiles === undefined ? null : (
              <Button size="sm" variant="secondary" onClick={onShowAllFiles}>
                All files
              </Button>
            )}
          </div>
        }
      />
    </div>
  );
};
