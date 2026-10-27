import { getProjectValue } from '@goodboy/db';
import type { MountId, Project, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../../shared/lib/db';
import {
  carryIntoWorktree,
  worktreeSetupProposal,
  type CreatedWorktree,
} from '../../../../features/worktree/worktree';
import {
  carryPathsOf,
  setupCommandOf,
  setupOfferKey,
  setupOfferValueOf,
} from '../../../../features/worktree/newWorktreeSettings';

type ReportParams = {
  readonly title: string;
  readonly error: unknown;
  readonly sessionId: SessionId;
};

type Params = {
  readonly saveSetting: (key: string, value: string) => Promise<void>;
  readonly reportError: (params: ReportParams) => Promise<void>;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly project: Project;
  readonly created: Pick<CreatedWorktree, 'worktreePath' | 'reused'>;
};

export const prepareNewWorktree = async ({
  saveSetting,
  reportError,
  sessionId,
  mountId,
  project,
  created,
}: Params): Promise<void> => {
  if (created.reused) {
    return;
  }
  try {
    const paths = carryPathsOf({
      raw: await getProjectValue({
        db: tauriDatabase,
        projectId: project.id,
        key: 'worktree.carry',
      }),
    });
    const outcomes =
      paths.length === 0
        ? []
        : await carryIntoWorktree({
            repoPath: project.rootPath,
            worktreePath: created.worktreePath,
            paths,
          });
    const saved = setupCommandOf({
      raw: await getProjectValue({
        db: tauriDatabase,
        projectId: project.id,
        key: 'worktree.setup',
      }),
    });
    const command =
      saved === undefined
        ? ((await worktreeSetupProposal({ repoPath: project.rootPath }))?.command ?? null)
        : saved;
    const carried = outcomes.filter((outcome) => outcome.status === 'copied').length;
    const skipped = outcomes.length - carried;
    if (command === null && outcomes.length === 0) {
      return;
    }
    await saveSetting(
      setupOfferKey({ mountId }),
      setupOfferValueOf({ offer: { command, carried, skipped, state: 'offered' } }),
    );
  } catch (error) {
    await reportError({ title: "Couldn't prepare the worktree", error, sessionId });
  }
};
