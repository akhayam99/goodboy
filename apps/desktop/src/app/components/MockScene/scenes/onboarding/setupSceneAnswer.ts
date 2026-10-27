import type { InvokeArgs } from '@tauri-apps/api/core';
import type { GitRepoCheck } from '@goodboy/types';

const HOME = '/mock';
const CODE_FOLDER = `${HOME}/Code`;
const DOCUMENTS_FOLDER = `${HOME}/Documents`;
const HARBORLINE_FOLDER = `${CODE_FOLDER}/harborline`;
const PICKER_MS = 300;

type RepoParams = {
  readonly name: string;
  readonly branch: string;
};

const HARBORLINE_REPOS: ReadonlyArray<RepoParams> = [
  { name: 'payments-api', branch: 'main' },
  { name: 'ledger-core', branch: 'main' },
  { name: 'notify-relay', branch: 'develop' },
];

type PathParams = {
  readonly path: string;
};

const isDirectlyUnderHome = ({ path }: PathParams): boolean =>
  path.startsWith(`${HOME}/`) && !path.slice(HOME.length + 1).includes('/');

const REPO_PARENTS: ReadonlyArray<string> = [HARBORLINE_FOLDER, CODE_FOLDER, DOCUMENTS_FOLDER];

const missingAt = ({ path }: PathParams): GitRepoCheck => ({
  isRepo: false,
  rootPath: null,
  resolvedPath: null,
  defaultBranch: null,
  error: `path does not exist: ${path}`,
  errorKind: 'not_found',
});

const repoCheckOf = ({ path }: PathParams): GitRepoCheck => {
  const repo = HARBORLINE_REPOS.find((entry) => `${HARBORLINE_FOLDER}/${entry.name}` === path);
  if (repo === undefined) {
    if (!REPO_PARENTS.includes(path) && isDirectlyUnderHome({ path })) {
      return missingAt({ path });
    }
    return {
      isRepo: false,
      rootPath: null,
      resolvedPath: path,
      defaultBranch: null,
      error: 'not a git repository',
      errorKind: 'not_a_repository',
    };
  }
  return {
    isRepo: true,
    rootPath: path,
    resolvedPath: path,
    defaultBranch: repo.branch,
    error: null,
    errorKind: null,
  };
};

type PayloadParams = {
  readonly payload: InvokeArgs | undefined;
};

type FieldParams = PayloadParams & {
  readonly field: string;
};

const fieldOf = ({ payload, field }: FieldParams): unknown => {
  if (payload === undefined || Array.isArray(payload) || payload instanceof ArrayBuffer) {
    return undefined;
  }
  if (payload instanceof Uint8Array) {
    return undefined;
  }
  return payload[field];
};

const pathOf = ({ payload }: PayloadParams): string => {
  const path = fieldOf({ payload, field: 'path' });
  return typeof path === 'string' ? path : '';
};

const COMMITTED = { rowsAffected: 1, rows: [] };

const statementsOf = ({ payload }: PayloadParams): ReadonlyArray<unknown> => {
  const statements = fieldOf({ payload, field: 'statements' });
  return Array.isArray(statements) ? statements : [];
};

type AnswerParams = PayloadParams & {
  readonly command: string;
};

export const setupSceneAnswer = ({ command, payload }: AnswerParams): unknown => {
  switch (command) {
    case 'plugin:dialog|open':
      return new Promise((resolve) => {
        window.setTimeout(() => resolve(HARBORLINE_FOLDER), PICKER_MS);
      });
    case 'plugin:path|resolve_directory':
      return HOME;
    case 'validate_git_repo':
      return repoCheckOf({ path: pathOf({ payload }) });
    case 'scan_child_repos':
      return REPO_PARENTS.includes(pathOf({ payload }))
        ? HARBORLINE_REPOS.map((repo) => ({
            name: repo.name,
            path: `${HARBORLINE_FOLDER}/${repo.name}`,
            defaultBranch: repo.branch,
          }))
        : [];
    case 'repo_identity':
      return { rootCommits: [], remoteUrl: null };
    case 'db_transaction':
      return { status: 'committed', results: statementsOf({ payload }).map(() => COMMITTED) };
    default:
      return null;
  }
};
