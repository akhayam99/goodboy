import type { Project, Session } from '@goodboy/types';
import { availableBranchName, nextFreeBranchName, slugify } from '@goodboy/core';
import { branchLeaf } from '../sessions/branchLeaf';
import { branchNamingSettings } from '../sessions/branchNamingSettings';
import { sessionBranchNaming } from '../sessions/sessionBranchNaming';
import type { GetFn } from './types';

type NamingParams = {
  readonly get: GetFn;
  readonly session: Session;
  readonly project: Project;
};

const sessionNaming = ({ get, session, project }: NamingParams) => {
  const settings = branchNamingSettings({
    state: get(),
    workspaceId: session.workspaceId,
    project,
  });
  const identifiers = (get().sessionExternalTasks[session.id] ?? []).map((task) => task.identifier);
  return sessionBranchNaming({
    template: settings.template,
    prefix: settings.prefix,
    user: settings.user,
    goal: session.goal,
    taskIdentifiers: identifiers,
  });
};

const firstSessionBranch = ({ get, session }: Omit<NamingParams, 'project'>): string | null =>
  (get().sessionProjectMounts[session.id] ?? [])
    .map((mount) => mount.branch)
    .find((branch) => branch !== '') ?? null;

export const resolveSessionSlug = ({ get, session, project }: NamingParams): string => {
  const existing = firstSessionBranch({ get, session });
  const fromBranch =
    existing === null ? '' : slugify({ input: branchLeaf({ branch: existing }), fallback: '' });
  if (fromBranch !== '') {
    return fromBranch;
  }
  const named = sessionNaming({ get, session, project }).values.slug ?? '';
  return slugify({ input: named, fallback: `session-${session.id.slice(0, 8)}` });
};

export const resolveRequestedBranchName = ({
  get,
  session,
  project,
  requested,
}: NamingParams & { readonly requested: string }): string => {
  if (requested.includes('/')) {
    return requested;
  }
  const { prefix } = branchNamingSettings({
    state: get(),
    workspaceId: session.workspaceId,
    project,
  });
  return `${prefix}/${requested}`;
};

type ForkParams = NamingParams & {
  readonly taken: ReadonlyArray<string>;
};

export const resolveForkBranchName = ({ get, session, project, taken }: ForkParams): string => {
  const existing = firstSessionBranch({ get, session });
  if (existing !== null) {
    return nextFreeBranchName({ name: existing, taken });
  }
  return availableBranchName({ ...sessionNaming({ get, session, project }), taken });
};
