import type { ClusterGraph } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { validateWriteScope } from '../../../features/worktree/worktree';

type Params = {
  readonly graph: ClusterGraph;
  readonly repoPath: string;
};

export const findWriteScopeEscape = async ({ graph, repoPath }: Params): Promise<string | null> => {
  for (const node of graph.nodes) {
    if (node.writeScope === undefined) {
      continue;
    }
    const violations = await validateWriteScope({
      repoPath,
      files: node.writeScope.files,
      directories: node.writeScope.directories,
    }).catch((error: unknown) => [
      { path: '', reason: `could not be checked on disk: ${formatError(error)}` },
    ]);
    const first = violations[0];
    if (first !== undefined) {
      return `cluster "${node.id}" declares write scope path "${first.path}", which ${first.reason}`;
    }
  }
  return null;
};
