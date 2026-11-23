import { listMountPullRequestLinks } from '@goodboy/db';
import type { MountPullRequestLink, SessionId, SessionMountView } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { WORK_KEPT } from '../notifications/errorRecovery';
import { loadMountViews } from '../project-mounts/mountViews';
import { canonicalPullRequestLinkOf } from '../project-mounts/workRecord/canonicalPullRequestLinkOf';
import { recoveryAttachOptionsOf } from '../project-mounts/workRecord/recoveryAttachOptionsOf';
import { projectById } from '../projects/projectIndex';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
};

type ReopenTarget = {
  readonly view: SessionMountView;
  readonly link: MountPullRequestLink;
};

const SETTLED_STATES: ReadonlyArray<MountPullRequestLink['state']> = ['merged', 'closed'];

type LinksParams = {
  readonly links: ReadonlyArray<MountPullRequestLink>;
};

const latestOpenLinkOf = ({ links }: LinksParams): MountPullRequestLink | null => {
  const latest = canonicalPullRequestLinkOf({ links });
  return latest === null || SETTLED_STATES.includes(latest.state) ? null : latest;
};

const reopenTargetsOf = async ({
  get,
  sessionId,
}: Params): Promise<ReadonlyArray<ReopenTarget>> => {
  const views = await loadMountViews({ get, sessionId });
  const detached = views.filter(
    (view) =>
      !view.isAttached &&
      view.worktreePath === null &&
      view.branch !== '' &&
      projectById(get().projects, view.projectId)?.kind === 'repo',
  );
  const targets = await Promise.all(
    detached.map(async (view) => {
      const links = await listMountPullRequestLinks({
        db: tauriDatabase,
        sessionId,
        mountId: view.id,
      });
      const link = latestOpenLinkOf({ links });
      return link === null ? [] : [{ view, link }];
    }),
  );
  return targets.flat();
};

export const reopenArchivedWork = async ({ get, sessionId }: Params): Promise<void> => {
  const targets = await reopenTargetsOf({ get, sessionId });
  for (const { view, link } of targets) {
    try {
      await get().attachMount({
        sessionId,
        mountId: view.id,
        expectedRevision: view.revision,
        ...recoveryAttachOptionsOf({ provider: link.provider, prNumber: link.prNumber }),
      });
    } catch (error) {
      const projectName = projectById(get().projects, view.projectId)?.name ?? view.mountName;
      await get().reportError({
        recovery: WORK_KEPT,
        severity: 'warning',
        title: `Couldn't bring back ${view.branch} in ${projectName}. Reopen it from the overview.`,
        error,
        sessionId,
      });
    }
  }
};
