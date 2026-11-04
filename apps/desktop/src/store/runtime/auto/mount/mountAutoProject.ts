import { formatError } from '@goodboy/ui';
import { materializationGate } from '../../../slices/project-mounts/materializationGate';
import { mountOnBranchOf } from './mountOnBranchOf';
import { sessionById } from '../../../slices/sessions/sessionIndex';
import type { GetFn } from '../../../slice-types';
import type { MountProjectOutcome, MountProjectParams } from '../ports';

type Params = {
  readonly get: GetFn;
  readonly params: MountProjectParams;
};

export const mountAutoProject = async ({ get, params }: Params): Promise<MountProjectOutcome> => {
  const { sessionId, name, branch, reason, mode } = params;
  const state = get();
  const session = sessionById(state.sessions, sessionId);
  if (session === undefined) {
    return { kind: 'unknown' };
  }
  const wanted = name.trim().toLowerCase();
  const matches = state.projects.filter(
    (project) =>
      project.workspaceId === session.workspaceId &&
      project.kind === 'repo' &&
      project.name.toLowerCase() === wanted,
  );
  const project = matches[0];
  if (project === undefined) {
    return { kind: 'unknown' };
  }
  if (matches.length > 1) {
    return { kind: 'ambiguous' };
  }
  const existing = mountOnBranchOf({
    mounts: state.sessionProjectMounts[sessionId] ?? [],
    projectId: project.id,
    branch,
  });
  if (existing.kind === 'elsewhere' && branch !== null) {
    return {
      kind: 'elsewhere',
      name: project.name,
      branch: existing.mount.branch,
      requested: branch,
    };
  }
  if (existing.kind === 'match') {
    return { kind: 'mounted', name: project.name, branch: existing.mount.branch };
  }
  if (mode === 'ask') {
    return { kind: 'ask', name: project.name };
  }
  if (mode === 'allowance') {
    const decision = materializationGate({
      get,
      sessionId,
      project,
      immediateProjectIds: new Set(),
    });
    if (decision.kind === 'deferred') {
      return { kind: 'ask', name: project.name };
    }
  }
  try {
    await get().ensureProjectMounted({
      sessionId,
      projectId: project.id,
      reason,
      ...(branch === null ? {} : { branch }),
    });
  } catch (error) {
    return { kind: 'failed', name: project.name, error: formatError(error) };
  }
  const created = mountOnBranchOf({
    mounts: get().sessionProjectMounts[sessionId] ?? [],
    projectId: project.id,
    branch,
  });
  if (created.kind === 'elsewhere' && branch !== null) {
    return {
      kind: 'elsewhere',
      name: project.name,
      branch: created.mount.branch,
      requested: branch,
    };
  }
  if (created.kind === 'match') {
    return { kind: 'mounted', name: project.name, branch: created.mount.branch };
  }
  return { kind: 'mounted', name: project.name, branch: branch ?? '' };
};
