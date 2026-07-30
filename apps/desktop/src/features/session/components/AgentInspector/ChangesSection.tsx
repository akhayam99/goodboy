import { FileText } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { BranchCommit } from '@goodboy/types';
import { CommitRow } from './CommitRow';
import { InspectorSection } from '../InspectorSection';

type Props = {
  readonly files: ReadonlyArray<string>;
  readonly reported: ReadonlyArray<BranchCommit>;
  readonly reportedMissingShas: ReadonlyArray<string>;
  readonly withinRunWindow: ReadonlyArray<BranchCommit>;
  readonly isLoading: boolean;
  readonly onOpenCommit?: (sha: string) => void;
  readonly onOpenFile?: (path: string) => void;
};

const FILE_ROW_CLASS = 'flex w-full min-w-0 items-baseline gap-2 text-left';

export const ChangesSection = ({
  files,
  reported,
  reportedMissingShas,
  withinRunWindow,
  isLoading,
  onOpenCommit,
  onOpenFile,
}: Props) => (
  <InspectorSection question="What it changed">
    {files.length > 0 ? (
      <ul className="flex flex-col gap-1">
        {files.map((path) => {
          const content = (
            <>
              <FileText size={11} aria-hidden className="shrink-0 text-muted-foreground/60" />
              <span className="truncate font-mono text-2xs text-foreground/80" title={path}>
                {path}
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
    ) : (
      <p className="text-2xs italic text-muted-foreground/70">
        {isLoading ? 'reading its turn history...' : 'no file edits recorded'}
      </p>
    )}
    {reported.length > 0 ? (
      <div className="flex flex-col gap-1">
        <span className="text-2xs text-muted-foreground/60">commits it reported</span>
        <ul className="flex flex-col gap-1">
          {reported.map((commit) => (
            <CommitRow
              key={commit.sha}
              commit={commit}
              onOpen={onOpenCommit === undefined ? undefined : () => onOpenCommit(commit.sha)}
            />
          ))}
        </ul>
      </div>
    ) : null}
    {reportedMissingShas.length > 0 ? (
      <div className="flex flex-col gap-1">
        <span className="text-2xs text-muted-foreground/60">reported, absent from the branch</span>
        <ul className="flex flex-col gap-1">
          {reportedMissingShas.map((sha) => (
            <li key={sha} className="font-mono text-2xs text-warning">
              {sha.slice(0, 7)}
            </li>
          ))}
        </ul>
      </div>
    ) : null}
    {withinRunWindow.length > 0 ? (
      <div className="flex flex-col gap-1">
        <span className="text-2xs text-muted-foreground/60">
          landed while it ran, author not verified
        </span>
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
    ) : null}
  </InspectorSection>
);
