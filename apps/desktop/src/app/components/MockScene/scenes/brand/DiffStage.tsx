import { useEffect } from 'react';
import { FilesPane } from '../../../../../features/session/components/SessionWorkspace/parts/FilesPane';
import { CTX_PAYMENTS_WORKTREE, CTX_SESSION_ID } from './contextBase';
import { CTX_COMMITS, CTX_STATUS } from './contextBranch';
import { CTX_PATCH } from './contextDiffPatch';
import { useFakeTauri, type FakeHandlers } from './fakeTauri';

const HANDLERS: FakeHandlers = {
  worktree_diff: () => CTX_PATCH,
  worktree_commits: () => CTX_COMMITS,
  worktree_status: () => CTX_STATUS,
};

const NOTE_PREFIX = 'Log the duplicate at info';

const useCenterNote = (): void => {
  useEffect(() => {
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
  }, []);
};

export const DiffStage = () => {
  useFakeTauri({ handlers: HANDLERS, holdMs: 1500 });
  useCenterNote();
  return (
    <FilesPane
      sessionId={CTX_SESSION_ID}
      sessionDir={CTX_PAYMENTS_WORKTREE}
      worktreePath={CTX_PAYMENTS_WORKTREE}
      isBranchless={false}
      onClose={() => undefined}
    />
  );
};
