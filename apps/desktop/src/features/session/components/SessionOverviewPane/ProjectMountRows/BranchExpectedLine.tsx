import { TruncatedText } from '@goodboy/ui';
import type { BranchFound } from './branchDecision';

type Props = {
  readonly expected: string;
  readonly found: BranchFound | null;
  readonly note: string | null;
};

const BRANCH = 'min-w-0 truncate text-code text-muted-foreground';
const WORD = 'shrink-0 whitespace-pre';

export const BranchExpectedLine = ({ expected, found, note }: Props) => (
  <span className="flex min-w-0 flex-col gap-1">
    <span data-branch-line="" className="flex min-w-0 items-baseline whitespace-nowrap">
      <span className={WORD}>Expected </span>
      <TruncatedText className={BRANCH}>{expected}</TruncatedText>
      {found === null ? null : (
        <>
          <span className={WORD}>, found </span>
          {found.isBranch ? (
            <TruncatedText className={BRANCH}>{found.text}</TruncatedText>
          ) : (
            <span className="min-w-0 truncate">{found.text}</span>
          )}
        </>
      )}
    </span>
    {note === null ? null : <span>{note}</span>}
  </span>
);
