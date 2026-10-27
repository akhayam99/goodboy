import { ICON_SIZE, SectionHeader } from '@goodboy/ui';
import type { BranchCommit, FileDiff } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { useNow } from '../../../../shared/hooks/useNow';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import type { MountDiffStat } from '../../../../store';

type Props = {
  readonly commits: ReadonlyArray<BranchCommit>;
  readonly files: ReadonlyArray<Pick<FileDiff, 'path' | 'additions' | 'deletions'>>;
  readonly stat: MountDiffStat | null;
};

const ROW = 'flex min-h-7 min-w-0 items-center gap-3 text-meta';

type CountParams = {
  readonly count: number;
  readonly one: string;
  readonly many: string;
};

const counted = ({ count, one, many }: CountParams): string =>
  `${count} ${count === 1 ? one : many}`;

export const BranchContents = ({ commits, files, stat }: Props) => {
  const now = useNow(60_000);
  if (commits.length === 0 && files.length === 0) {
    return null;
  }
  return (
    <section aria-label="In this branch" className="flex min-w-0 flex-col gap-3">
      <SectionHeader label="In this branch" headingLevel={2} />
      {commits.length === 0 ? null : (
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-meta text-muted-foreground">
            {counted({ count: commits.length, one: 'commit', many: 'commits' })}
          </h3>
          <ul className="flex min-w-0 flex-col">
            {commits.map((commit) => (
              <li key={commit.sha} className={ROW}>
                <CONCEPT_ICONS.commits
                  size={ICON_SIZE.row}
                  aria-hidden
                  className="shrink-0 text-faint-foreground"
                />
                <span className="min-w-0 flex-1 truncate text-foreground">{commit.subject}</span>
                <span className="shrink-0 text-code text-faint-foreground">{commit.shortSha}</span>
                <span className="shrink-0 text-meta text-faint-foreground">
                  {formatAge({ from: new Date(commit.timestamp * 1000).toISOString(), now })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {files.length === 0 ? null : (
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="flex items-center gap-2 text-meta text-muted-foreground">
            {counted({ count: files.length, one: 'file', many: 'files' })}
            {stat === null ? null : (
              <>
                <span className="text-success">+{stat.additions}</span>
                <span className="text-danger">-{stat.deletions}</span>
              </>
            )}
          </h3>
          <ul className="flex min-w-0 flex-col">
            {files.map((file) => (
              <li key={file.path} className={ROW}>
                <span className="min-w-0 flex-1 truncate text-code text-foreground">
                  {file.path}
                </span>
                <span className="shrink-0 text-meta text-success">+{file.additions}</span>
                <span className="w-8 shrink-0 text-right text-meta text-danger">
                  -{file.deletions}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
