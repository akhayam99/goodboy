import type { ReviewCommitPreset } from './reviewCommits';

export const REVIEW_COMMITS_LABEL = {
  presets: 'Arrange the resolve commits',
  custom: 'Custom',
  after: 'After',
  noChange: 'no change',
  reset: 'Reset',
  rewrite: 'Rewrite',
  rewriteAndPush: 'Rewrite and push',
  undo: 'Undo',
  openHistory: 'Open Rewrite history',
  onOrigin: 'on origin',
  localOnly: 'local only',
  you: 'you',
  reword: 'Reword…',
  reworded: 'Reworded',
  rewordLabel: 'New commit message',
  keep: 'Keep',
  squashAbove: 'Squash with the one above',
  restored: 'Back to the branch as it was before the rewrite.',
  pushedWithLease: 'Pushed with a lease',
  notPushed: 'Not pushed',
  noBranch: 'This session has no branch to show commits for.',
  empty: 'This branch has no commits of its own yet.',
  loading: 'Reading the branch',
  foreignDraft: 'You have an unsaved plan in Rewrite history',
  foreignDraftBody: 'The Commits view leaves it alone until you replace it.',
  openDraft: 'Open it',
  replaceDraft: 'Replace it',
  replies: 'Replies',
  editPosted: 'Edit the posted reply',
  postedLeft: 'Posted, left as it is',
  posted: 'Posted',
  goesOut: 'Goes out with the next push',
  waitingForCheck: 'The new sha shows once the check is done',
} as const;

export const unpostedReplyLine = ({
  from,
  to,
  isFolded,
}: {
  readonly from: string;
  readonly to: string;
  readonly isFolded: boolean;
}): string => (isFolded ? `Fixed in ${from}, squashed into ${to}.` : `Fixed in ${to}.`);

export const PRESET_LABEL: Record<ReviewCommitPreset, string> = {
  keep: 'Keep as they are',
  fold: 'Fold each into its original',
  one: 'One commit for the review',
};

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five'];

const countWord = ({ count }: { readonly count: number }): string => WORDS[count] ?? String(count);

export const commitCountLabel = ({ count }: { readonly count: number }): string =>
  `${count} ${count === 1 ? 'commit' : 'commits'}`;

export const branchCommitsLine = ({ count }: { readonly count: number }): string =>
  `${commitCountLabel({ count })}, oldest first`;

export const foldIntoLabel = ({ shortSha }: { readonly shortSha: string }): string =>
  `Fold into ${shortSha}`;

export const commitForLine = ({
  author,
  location,
}: {
  readonly author: string | null;
  readonly location: string | null;
}): string => {
  const who = author ?? 'a reviewer';
  return location === null ? `for ${who}` : `for ${who} on ${location}`;
};

const namesOf = ({ names }: { readonly names: ReadonlyArray<string> }): string => {
  if (names.length < 3) {
    return names.join(' and ');
  }
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''}`;
};

export const withFixesFor = ({ authors }: { readonly authors: ReadonlyArray<string> }): string =>
  `with fixes for ${namesOf({ names: [...new Set(authors.map((author) => author.split(' ')[0] ?? author))] })}`;

export const rewriteNote = ({
  hasChange,
  replaced,
}: {
  readonly hasChange: boolean;
  readonly replaced: number;
}): string => {
  if (!hasChange) {
    return 'Pick a preset or set each commit. Nothing changes until you rewrite.';
  }
  if (replaced > 0) {
    return `${countWord({ count: replaced })} ${replaced === 1 ? 'commit' : 'commits'} on origin will be replaced. This is a force push with a lease: nobody's newer work gets overwritten, and reviewers will see "force-pushed".`;
  }
  return 'Nothing on origin changes. This stays on your machine until you push.';
};

export const conflictLine = ({ files }: { readonly files: ReadonlyArray<string> }): string =>
  `${files.length} ${files.length === 1 ? 'conflict' : 'conflicts'} in ${files.join(', ')}`;

export const CHECK_COPY = {
  predicting: 'Predicting the result',
  clean: 'Predicted clean',
  sameCode: 'same final code',
  unsupported: 'No prediction with this git version. The rewrite is still tried in a copy first.',
  conflictHint: 'Rewrite history can hand it to an agent.',
} as const;

export const REWRITE_STAGES = [
  'Rewriting in a copy',
  'checking',
  'moving the branch',
  'pushing with a lease',
] as const;

export const backupLine = ({ backupRef }: { readonly backupRef: string }): string =>
  `Backup kept as ${backupRef}.`;
