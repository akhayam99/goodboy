import { formatError } from '@goodboy/ui';
import type { Project } from '@goodboy/types';
import { worktreeErrorKind } from '../../../../../store/slices/project-mounts/mountErrors';
import type { MountPreflight } from './useMountPreflight/resolveMountPreflight';

export type MountFailure = {
  readonly cause: string;
  readonly detail: string;
};

type Params = {
  readonly error: unknown;
  readonly project: Project;
  readonly preflight: MountPreflight | null;
};

const rawError = ({ error }: { readonly error: unknown }): string => {
  if (error instanceof Error && error.stack != null) {
    return error.stack;
  }
  try {
    return JSON.stringify(error, null, 2) ?? String(error);
  } catch {
    return String(error);
  }
};

export const mountFailure = ({ error, project, preflight }: Params): MountFailure => {
  const kind = worktreeErrorKind({ error });
  const lines = [
    `project: ${project.name} (${project.rootPath})`,
    ...(preflight?.branch == null ? [] : [`branch: ${preflight.branch}`]),
    ...(preflight?.baseBranch == null ? [] : [`base: ${preflight.baseBranch}`]),
    ...(preflight == null ? [] : [`path: ${preflight.targetPath}`]),
    ...(kind === null ? [] : [`kind: ${kind}`]),
    rawError({ error }),
  ];
  return { cause: formatError(error), detail: lines.join('\n') };
};
