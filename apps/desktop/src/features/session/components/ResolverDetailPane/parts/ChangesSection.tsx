import { FileText } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { BranchCommit } from '@goodboy/types';
import { CommitRow } from './CommitRow';
import { ResolverPanelSection } from './ResolverPanelSection';
import { displayPath } from '../../../../../shared/utils/display-path';

type Props = {
  readonly files: ReadonlyArray<string>;
  readonly reported: ReadonlyArray<BranchCommit>;
  readonly reportedMissingShas: ReadonlyArray<string>;
  readonly withinRunWindow: ReadonlyArray<BranchCommit>;
  readonly worktreePath: string | null;
  readonly onOpenCommit?: (sha: string) => void;
  readonly onOpenFile?: (path: string) => void;
};

const FILE_ROW_CLASS = 'flex w-full min-w-0 items-baseline gap-2 text-left';

const MISSING_SHA_CLASS = 'font-mono text-2xs text-warning';

const GROUP_LABEL_CLASS = 'text-2xs text-muted-foreground/60';

export const ChangesSection = ({
  files,
  reported,
  reportedMissingShas,
  withinRunWindow,
  worktreePath,
  onOpenCommit,
  onOpenFile,
}: Props) => {
  const hasCommit =
    reported.length > 0 || reportedMissingShas.length > 0 || withinRunWindow.length > 0;

  if (!hasCommit) {
    return null;
  }

  return (
    <ResolverPanelSection label="Changes">
      {reported.length > 0 && (
        <ul className="flex flex-col gap-1">
          {reported.map((commit) => (
            <CommitRow
              key={commit.sha}
              commit={commit}
              onOpen={onOpenCommit === undefined ? undefined : () => onOpenCommit(commit.sha)}
            />
          ))}
        </ul>
      )}
      {reportedMissingShas.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className={GROUP_LABEL_CLASS}>reported, absent from the branch</span>
          <ul className="flex flex-col gap-1">
            {reportedMissingShas.map((sha) => (
              <li key={sha} className="min-w-0">
                {onOpenCommit === undefined ? (
                  <span className={MISSING_SHA_CLASS}>{sha.slice(0, 7)}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onOpenCommit(sha)}
                    title={`Open the diff of ${sha}`}
                    className={cn(
                      MISSING_SHA_CLASS,
                      'cursor-pointer rounded-md text-left underline-offset-2 motion-safe:transition-colors hover:text-foreground hover:underline',
                    )}
                  >
                    {sha.slice(0, 7)}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {withinRunWindow.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className={GROUP_LABEL_CLASS}>landed while it ran, author not verified</span>
          <ul className="flex flex-col gap-1">
            {withinRunWindow.map((commit) => (
              <CommitRow
                key={commit.sha}
                commit={commit}
                onOpen={onOpenCommit === undefined ? undefined : () => onOpenCommit(commit.sha)}
              />
            ))}
          </ul>
        </div>
      )}
      {files.length > 0 && (
        <ul className="flex flex-col gap-1">
          {files.map((path) => {
            const content = (
              <>
                <FileText size={11} aria-hidden className="shrink-0 text-muted-foreground/60" />
                <span className="truncate font-mono text-2xs text-foreground/80" title={path}>
                  {displayPath(path, worktreePath)}
                </span>
              </>
            );
            return (
              <li key={path} className="min-w-0">
                {onOpenFile === undefined ? (
                  <span className={FILE_ROW_CLASS}>{content}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onOpenFile(path)}
                    title={`Open the diff at ${path}`}
                    className={cn(
                      FILE_ROW_CLASS,
                      'rounded-md motion-safe:transition-colors hover:text-primary',
                    )}
                  >
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </ResolverPanelSection>
  );
};
