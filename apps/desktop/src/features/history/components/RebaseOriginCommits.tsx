import { TruncatedText } from '@goodboy/ui';
import type { HistoryRebaseCommit } from '@goodboy/types';

type Props = {
  readonly commits: ReadonlyArray<HistoryRebaseCommit>;
};

const SHORT_SHA = 7;

export const RebaseOriginCommits = ({ commits }: Props) => {
  if (commits.length === 0) {
    return null;
  }
  return (
    <ul aria-label="New on origin" className="flex w-full min-w-0 flex-col gap-1">
      {commits.map((commit) => (
        <li
          key={commit.sha}
          className="grid min-h-7 min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2"
        >
          <span className="text-code text-faint-foreground">{commit.sha.slice(0, SHORT_SHA)}</span>
          <TruncatedText className="min-w-0 truncate text-label text-foreground">
            {commit.subject}
          </TruncatedText>
        </li>
      ))}
    </ul>
  );
};
