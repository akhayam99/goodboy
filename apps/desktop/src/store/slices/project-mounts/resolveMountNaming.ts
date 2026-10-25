import type { Project, Session } from '@goodboy/types';
import { availableBranchName, nextFreeBranchName } from '@goodboy/core';
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

type PrefixedParams = {
  readonly requested: string;
  readonly prefix: string;
};

const prefixedBranchName = ({ requested, prefix }: PrefixedParams): string => {
  if (requested.startsWith(`${prefix}/`)) {
    return requested;
  }
  return `${prefix}/${requested.replace(/\/+/g, '-')}`;
};

export const resolveRequestedBranchName = ({
  get,
  session,
  project,
  requested,
}: NamingParams & { readonly requested: string }): string => {
  const { prefix } = branchNamingSettings({
    state: get(),
    workspaceId: session.workspaceId,
    project,
  });
  return prefixedBranchName({ requested, prefix });
};

type ForkParams = NamingParams & {
  readonly taken: ReadonlyArray<string>;
  readonly taskIdentifier?: string;
  readonly taskTitle?: string;
};

export const resolveForkBranchName = ({
  get,
  session,
  project,
  taken,
  taskIdentifier,
  taskTitle,
}: ForkParams): string => {
  if (taskIdentifier !== undefined && taskIdentifier.trim() !== '') {
    const settings = branchNamingSettings({
      state: get(),
      workspaceId: session.workspaceId,
      project,
    });
    return availableBranchName({
      ...sessionBranchNaming({
        template: settings.template,
        prefix: settings.prefix,
        user: settings.user,
        goal: taskTitle ?? session.goal,
        taskIdentifiers: [taskIdentifier],
      }),
      taken,
    });
  }
  const existing = firstSessionBranch({ get, session });
  if (existing !== null) {
    return nextFreeBranchName({ name: existing, taken });
  }
  return availableBranchName({ ...sessionNaming({ get, session, project }), taken });
};
