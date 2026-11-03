import { useCallback, useRef } from 'react';
import type { FileDiff } from '@goodboy/types';
import { worktreeFileSides } from '../../../worktree/worktree';
import { useScrollToLine } from '../../hooks/useScrollToLine';
import { DiffView } from '../DiffView';

type Props = {
  readonly worktreePath: string;
  readonly baseBranch: string | null;
  readonly file: FileDiff;
  readonly line: number;
};

export const PeekFileDiff = ({ worktreePath, baseBranch, file, line }: Props) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const loadFileSides = useCallback(
    (target: FileDiff) => worktreeFileSides({ worktreePath, path: target.path, baseBranch }),
    [baseBranch, worktreePath],
  );
  useScrollToLine({ containerRef: hostRef, path: file.path, line });
  return (
    <div
      ref={hostRef}
      className="flex min-h-0 flex-1 flex-col [&_[data-peek-flash]]:bg-[color-mix(in_srgb,var(--color-primary)_20%,transparent)]"
    >
      <DiffView
        key={file.path}
        files={[file]}
        presentation="peek"
        isWholeFile
        loadFileSides={loadFileSides}
      />
    </div>
  );
};
