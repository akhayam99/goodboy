import { useEffect } from 'react';
import { BranchPage } from '../../../../../features/branch/components/BranchPage';
import { CTX_PAYMENTS_WORKTREE, CTX_SESSION } from './contextBase';
import { CTX_COMMITS, CTX_STATUS } from './contextBranch';
import { BRANCH_FILES_PATCH } from './contextDiffPatch';
import { useFakeTauri, type FakeHandlers } from './fakeTauri';

export const handlersFor = (patch: string): FakeHandlers => ({
  worktree_diff: () => patch,
  worktree_commits: () => CTX_COMMITS,
  worktree_status: () => CTX_STATUS,
});

const DEFAULT_HANDLERS = handlersFor(BRANCH_FILES_PATCH);

const NOTE_PREFIX = 'Log the duplicate at info';

const useCenterNote = (isEnabled: boolean): void => {
  useEffect(() => {
    if (!isEnabled) {
      return;
    }
    let tries = 0;
    const interval = window.setInterval(() => {
      tries += 1;
      const note = [...document.querySelectorAll('p, div, span')].find(
        (node) => node.childElementCount === 0 && node.textContent?.startsWith(NOTE_PREFIX),
      );
      if (note !== undefined) {
        note.scrollIntoView({ block: 'center' });
        window.clearInterval(interval);
        return;
      }
      if (tries > 40) {
        window.clearInterval(interval);
      }
    }, 150);
    return () => window.clearInterval(interval);
  }, [isEnabled]);
};

type Props = {
  readonly handlers?: FakeHandlers;
  readonly centerNote?: boolean;
};

export const DiffStage = ({ handlers = DEFAULT_HANDLERS, centerNote = true }: Props) => {
  useFakeTauri({ handlers, holdMs: 1500 });
  useCenterNote(centerNote);
  return <BranchPage session={CTX_SESSION} workingDir={CTX_PAYMENTS_WORKTREE} />;
};
