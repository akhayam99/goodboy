import { findPrSeriesMembership, upsertMountPullRequestLink } from '@goodboy/db';
import type { IsoDateTime, MountId, ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import {
  gitlabCreateMr,
  gitlabMrForBranch,
  type GitlabMergeRequest,
} from '../../../features/integrations/gitlab/client';
import { appendClosingReferences } from '../../../features/integrations/github/appendClosingReferences';
import { partOfReferences } from '../../../features/integrations/github/partOfReferences';
import { seriesReferenceLines } from '../pr-series/seriesReferences';
import { tauriDatabase } from '../../../shared/lib/db';
import { mountRequestEventPayload } from '../project-mounts/mountRequests';
import { gitlabRequestIdentity, toMountMrLink } from './mrLink';
import { resolveMrContext, resolveSessionMrTarget } from './resolveMrContext';
import type { GetFn, SetFn } from './types';
import { projectById } from '../projects/projectIndex';

type CreateMrReferenceMode = 'closing' | 'part-of' | 'none';

export type CreateMrInput = {
  readonly sessionId: SessionId;
  readonly mountId?: MountId;
  readonly title?: string;
  readonly description?: string;
  readonly targetBranch?: string;
  readonly draft?: boolean;
  readonly referenceMode?: CreateMrReferenceMode;
};

export type CreatedMr = {
  readonly number: number;
  readonly url: string;
};

const OPEN_STATES: ReadonlySet<string> = new Set(['opened', 'locked']);

type LookupParams = {
  readonly workspaceId: WorkspaceId;
  readonly host: string;
  readonly projectPath: string;
  readonly branch: string;
  readonly projectId: ProjectId;
};

const lookupOpenMr = async ({
  workspaceId,
  host,
  projectPath,
  branch,
  projectId,
}: LookupParams): Promise<GitlabMergeRequest | null> => {
  let found: GitlabMergeRequest | null = null;
  try {
    found = await gitlabMrForBranch(workspaceId, host, projectPath, branch, projectId);
  } catch {
    found = null;
  }
  return found !== null && OPEN_STATES.has(found.state) ? found : null;
};

export const createMrForSession = (_set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    mountId,
    title,
    description,
    targetBranch,
    draft,
    referenceMode,
  }: CreateMrInput): Promise<CreatedMr> => {
    const target = resolveSessionMrTarget({
      get,
      sessionId,
      ...(mountId === undefined ? {} : { mountId }),
    });
    const context = target === null ? null : await resolveMrContext({ get, sessionId, target });
    if (target === null || context === null) {
      throw new Error(
        'No GitLab project is linked to this session yet, open it once so its worktree resolves.',
      );
    }
    const mount = target.mount;
    const projectBaseBranch = projectById(get().projects, mount.projectId)?.baseBranch;
    const base = targetBranch?.trim() || mount.baseBranch || projectBaseBranch || 'main';
    const resolvedTitle = title?.trim() || context.goal;
    const isDraft = draft ?? true;
    const membership = await findPrSeriesMembership({
      db: tauriDatabase,
      sessionId,
      mountId: mount.id,
      branch: mount.branch,
    });
    const mode = referenceMode ?? (membership === null ? 'closing' : 'part-of');
    const filledDescription = description ?? '';
    const seriesLines =
      membership === null || mode !== 'part-of'
        ? []
        : seriesReferenceLines({
            series: membership.series,
            member: membership.member,
            body: filledDescription,
          });
    const taskLines =
      mode === 'part-of'
        ? partOfReferences({
            tasks: get().sessionExternalTasks[sessionId] ?? [],
            branch: mount.branch,
            body: filledDescription,
          }).filter((line) => !seriesLines.includes(line))
        : [];
    const resolvedDescription = appendClosingReferences({
      body: filledDescription,
      references: [],
      lines: [...taskLines, ...seriesLines],
    });
    const existing = await lookupOpenMr({
      workspaceId: context.workspaceId,
      host: context.host,
      projectPath: context.projectPath,
      branch: mount.branch,
      projectId: mount.projectId,
    });
    const isAdopted = existing !== null;
    const openMr = async (): Promise<GitlabMergeRequest> => {
      try {
        return await gitlabCreateMr({
          workspaceId: context.workspaceId,
          host: context.host,
          projectPath: context.projectPath,
          sourceBranch: mount.branch,
          targetBranch: base,
          title: resolvedTitle,
          description: resolvedDescription,
          draft: isDraft,
        });
      } catch (err) {
        const errMsg = formatError(err);
        void get().emitNotification({
          kind: 'error',
          severity: 'error',
          title: "Couldn't create the merge request",
          body: errMsg,
          sessionId,
          workspaceId: context.workspaceId,
        });
        throw err;
      }
    };
    const created = existing ?? (await openMr());
    let unrecorded: { readonly error: unknown } | null = null;
    try {
      const observedAt = new Date().toISOString() as IsoDateTime;
      const link = toMountMrLink({
        mountId: mount.id,
        host: context.host,
        projectPath: context.projectPath,
        mr: created,
        existing: null,
        observedAt,
      });
      await upsertMountPullRequestLink({ db: tauriDatabase, sessionId, link });
      await get().recordSessionEventOnce({
        sessionId,
        kind: 'pr_created',
        payload: mountRequestEventPayload({
          mountId: mount.id,
          projectId: mount.projectId,
          identity: gitlabRequestIdentity({
            host: context.host,
            projectPath: context.projectPath,
            mr: created,
          }),
          title: resolvedTitle,
          url: created.webUrl,
          branch: mount.branch,
        }),
      });
    } catch (error) {
      unrecorded = { error };
    }
    try {
      await get().refreshSessionMr(sessionId, { force: true, mountId: mount.id });
    } catch (error) {
      unrecorded ??= { error };
    }
    if (unrecorded !== null) {
      void get().emitNotification({
        kind: 'error',
        severity: 'warning',
        title: `Opened !${created.iid}, but Goodboy could not save the link`,
        body: `Refresh to pick it up. ${formatError(unrecorded.error)}`,
        sessionId,
        workspaceId: context.workspaceId,
      });
    }
    void get().emitNotification({
      kind: 'pr-created',
      severity: 'success',
      title: isAdopted
        ? `Linked the existing merge request for ${context.goal}`
        : `Merge request created for ${context.goal}`,
      sessionId,
      workspaceId: context.workspaceId,
    });
    return { number: created.iid, url: created.webUrl };
  };
};
