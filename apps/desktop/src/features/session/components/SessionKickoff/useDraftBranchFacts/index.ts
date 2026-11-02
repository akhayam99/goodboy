import { useCallback, useEffect, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { projectById } from '../../../../../store/slices/projects/projectIndex';
import { draftBranchFactsOf } from '../../../../../store/slices/sessionDraft/draftBranchFactsOf';
import type { DraftBranchChoice } from '../../../../../store/slices/sessionDraft/state';
import { selectSessionDraft } from '../../../../../store/slices/sessionDraft/selectSessionDraft';
import { listBranchNames, worktreeBranchHolder } from '../../../../worktree/worktree';
import type { ExistingBranchFacts } from '../../ExistingBranchNotice';

const DEBOUNCE_MS = 400;

type Params = {
  readonly workspaceId: WorkspaceId;
};

type ChooseParams = {
  readonly pick: DraftBranchChoice['pick'];
};

type Read = {
  readonly facts: ExistingBranchFacts | null;
  readonly error: string | null;
};

type Result = Read & {
  readonly choose: (params: ChooseParams) => void;
};

const NOTHING: Read = { facts: null, error: null };

export const useDraftBranchFacts = ({ workspaceId }: Params): Result => {
  const goal = useAppStore((state) =>
    selectSessionDraft({ state, workspaceId }).workflowGoal.trim(),
  );
  const projectId = useAppStore(
    (state) => selectSessionDraft({ state, workspaceId }).projectIds[0] ?? null,
  );
  const choice = useAppStore((state) => selectSessionDraft({ state, workspaceId }).branchChoice);
  const project = useAppStore((state) => projectById(state.projects, projectId) ?? null);
  const patchSessionDraft = useAppStore((state) => state.patchSessionDraft);
  const [read, setRead] = useState<Read>(NOTHING);
  const repoPath = project?.kind === 'repo' ? project.rootPath : null;
  const baseBranch = project?.baseBranch ?? null;
  const isChoiceStale = choice !== null && (choice.projectId !== projectId || choice.goal !== goal);
  const pick = choice === null || isChoiceStale ? null : choice.pick;

  useEffect(() => {
    if (isChoiceStale) {
      patchSessionDraft({ workspaceId, patch: { branchChoice: null } });
    }
  }, [isChoiceStale, patchSessionDraft, workspaceId]);

  useEffect(() => {
    if (repoPath === null || goal === '') {
      setRead(NOTHING);
      return;
    }
    let isCurrent = true;
    const timer = setTimeout(() => {
      void listBranchNames({ repoPath })
        .then(async (branches): Promise<Read> => {
          const found = draftBranchFactsOf({ goal, branches, baseBranch, choice: pick });
          if (found === null) {
            return NOTHING;
          }
          if (found.branch === null || pick?.kind === 'worktree') {
            return { facts: { ...found, checkedOutAt: null }, error: null };
          }
          return worktreeBranchHolder({ repoPath, branch: found.branch }).then(
            (checkedOutAt) => ({ facts: { ...found, checkedOutAt }, error: null }),
            (error: unknown) => ({
              facts: { ...found, checkedOutAt: null },
              error: formatError(error),
            }),
          );
        })
        .then(
          (next) => {
            if (isCurrent) {
              setRead(next);
            }
          },
          (error: unknown) => {
            if (isCurrent) {
              setRead({ facts: null, error: formatError(error) });
            }
          },
        );
    }, DEBOUNCE_MS);
    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [repoPath, baseBranch, goal, pick]);

  const choose = useCallback(
    ({ pick: next }: ChooseParams) => {
      if (projectId === null) {
        return;
      }
      patchSessionDraft({
        workspaceId,
        patch: { branchChoice: { projectId, goal, pick: next } },
      });
    },
    [goal, patchSessionDraft, projectId, workspaceId],
  );

  return { ...read, choose };
};
