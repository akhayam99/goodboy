import { isCommitListCapped } from '../../lib/branchCommitsLabel';

type Props = {
  readonly listed: number;
  readonly total: number | null;
};

export const CommitListCap = ({ listed, total }: Props) =>
  isCommitListCapped({ listed, total }) ? (
    <span className="px-4 py-1 text-meta italic text-faint-foreground">
      Showing latest {listed}
    </span>
  ) : null;
