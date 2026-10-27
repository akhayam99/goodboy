import type { BranchFound } from './branchDecision';

type Props = {
  readonly expected: string;
  readonly found: BranchFound | null;
  readonly note: string | null;
};

const BRANCH = 'break-words text-code text-muted-foreground';

export const BranchExpectedLine = ({ expected, found, note }: Props) => (
  <span className="flex min-w-0 flex-col gap-1">
    <span data-branch-line="" className="min-w-0 break-words">
      <span>Expected </span>
      <span className={BRANCH}>{expected}</span>
      {found === null ? null : (
        <>
          <span>, found </span>
          <span className={found.isBranch ? BRANCH : undefined}>{found.text}</span>
        </>
      )}
    </span>
    {note === null ? null : <span>{note}</span>}
  </span>
);
