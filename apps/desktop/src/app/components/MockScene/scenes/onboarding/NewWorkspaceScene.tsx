import { useEffect, useState } from 'react';
import type { InvokeArgs } from '@tauri-apps/api/core';
import {
  brandId,
  type GitRepoCheck,
  type Project,
  type ProjectId,
  type Workspace,
  type WorkspaceId,
} from '@goodboy/types';
import { NewWorkspaceForm } from '../../../../../shared/components/NewWorkspaceForm';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { SETTING_NEW_PROJECT_PARENT } from '../../../../../features/settings/settings';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import { mockSceneIpc } from '../mockSceneIpc';

export type NewWorkspaceSceneState =
  'empty' | 'repo' | 'many' | 'plain' | 'conflict' | 'denied' | 'scratch';

type Props = {
  readonly state: NewWorkspaceSceneState;
  readonly theme: 'dark' | 'light';
};

const clock = sceneClock({ anchor: '2026-10-17T09:00:00.000Z' });
const NOW = clock.iso({ at: '2026-10-17T09:00:00.000Z' });

const HOME = '/mock';
const CODE = `${HOME}/Code`;
const ACME_WEB = `${CODE}/acme-web`;
const ACME_DOCS = `${CODE}/acme-docs`;
const HARBORLINE = `${CODE}/harborline`;
const DENIED = `${HOME}/Documents/acme-web`;

const OVERRIDES = {
  defaultProviderId: null,
  defaultBranchPrefix: null,
  defaultVerbosity: null,
  providerBindings: null,
  taskModels: null,
  roleModels: null,
  parallelAgents: null,
  providerPool: null,
  attributionFooter: null,
  replyVoice: null,
  replyStyleNote: null,
  replyTemplateFixed: null,
  replyTemplateNoChange: null,
  resolveOnGithub: null,
  resolveCommitStyle: null,
  afterMerge: null,
  defaultBranchTemplate: null,
};

const NORTHWIND: Workspace = {
  id: brandId<WorkspaceId>({ value: 'mock-workspace-northwind' }),
  name: 'Northwind',
  slug: 'northwind',
  overrides: OVERRIDES,
  createdAt: NOW,
  updatedAt: NOW,
};

const PAYMENTS: Project = {
  id: brandId<ProjectId>({ value: 'mock-project-payments-api' }),
  workspaceId: NORTHWIND.id,
  name: 'payments-api',
  rootPath: `${HARBORLINE}/payments-api`,
  kind: 'repo',
  overrides: OVERRIDES,
  createdAt: NOW,
  updatedAt: NOW,
};

type RepoParams = {
  readonly path: string;
  readonly branch: string;
};

const repoAt = ({ path, branch }: RepoParams): GitRepoCheck => ({
  isRepo: true,
  rootPath: path,
  resolvedPath: path,
  defaultBranch: branch,
  error: null,
  errorKind: null,
});

type PathParams = {
  readonly path: string;
};

const plainAt = ({ path }: PathParams): GitRepoCheck => ({
  isRepo: false,
  rootPath: null,
  resolvedPath: path,
  defaultBranch: null,
  error: 'not a git repository',
  errorKind: 'not_a_repository',
});

const CHECKS: Readonly<Record<string, GitRepoCheck>> = {
  [ACME_WEB]: repoAt({ path: ACME_WEB, branch: 'main' }),
  [ACME_DOCS]: plainAt({ path: ACME_DOCS }),
  [HARBORLINE]: plainAt({ path: HARBORLINE }),
  [`${HARBORLINE}/payments-api`]: repoAt({ path: `${HARBORLINE}/payments-api`, branch: 'main' }),
  [`${HARBORLINE}/ledger-core`]: repoAt({ path: `${HARBORLINE}/ledger-core`, branch: 'main' }),
  [`${HARBORLINE}/notify-relay`]: repoAt({
    path: `${HARBORLINE}/notify-relay`,
    branch: 'develop',
  }),
  [DENIED]: {
    isRepo: false,
    rootPath: null,
    resolvedPath: DENIED,
    defaultBranch: null,
    error: 'Operation not permitted',
    errorKind: 'permission_denied',
  },
};

const HARBORLINE_REPOS = [
  { name: 'payments-api', path: `${HARBORLINE}/payments-api`, defaultBranch: 'main' },
  { name: 'ledger-core', path: `${HARBORLINE}/ledger-core`, defaultBranch: 'main' },
  { name: 'notify-relay', path: `${HARBORLINE}/notify-relay`, defaultBranch: 'develop' },
];

const PICK = {
  empty: null,
  repo: ACME_WEB,
  many: HARBORLINE,
  plain: ACME_DOCS,
  conflict: HARBORLINE,
  denied: DENIED,
  scratch: null,
} as const satisfies Record<NewWorkspaceSceneState, string | null>;

const COLUMN_TOP_PX = 116;

type AnswerParams = {
  readonly state: NewWorkspaceSceneState;
};

const pathOf = (payload: InvokeArgs | undefined): string => {
  if (payload === undefined || Array.isArray(payload) || payload instanceof ArrayBuffer) {
    return '';
  }
  if (payload instanceof Uint8Array) {
    return '';
  }
  const path = payload['path'];
  return typeof path === 'string' ? path : '';
};

const answerFor =
  ({ state }: AnswerParams) =>
  (command: string, payload: InvokeArgs | undefined): unknown => {
    switch (command) {
      case 'plugin:dialog|open':
        return PICK[state];
      case 'plugin:path|resolve_directory':
        return HOME;
      case 'validate_git_repo':
        return CHECKS[pathOf(payload)] ?? plainAt({ path: pathOf(payload) });
      case 'scan_child_repos':
        return pathOf(payload) === HARBORLINE ? HARBORLINE_REPOS : [];
      case 'repo_identity':
        return { rootCommits: [], remoteUrl: null };
      default:
        return null;
    }
  };

type TypeParams = {
  readonly input: HTMLInputElement;
  readonly text: string;
};

const typeInto = ({ input, text }: TypeParams): void => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

const clickChooseFolder = (): void => {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>('form button')).find(
    (candidate) => candidate.textContent?.startsWith('Choose folder') === true,
  );
  button?.click();
};

const fillScratchName = (): void => {
  const input = document.querySelector<HTMLInputElement>('input[placeholder="acme-api"]');
  if (input !== null) {
    typeInto({ input, text: 'acme-api' });
  }
};

const seed = ({ state }: AnswerParams): void => {
  mockSceneIpc(answerFor({ state }));
  useAppStore.setState({
    hydrated: true,
    workspaces: [NORTHWIND],
    currentWorkspaceId: null,
    projects: [PAYMENTS],
    settings: { [SETTING_NEW_PROJECT_PARENT]: CODE },
  });
  if (state === 'conflict') {
    useAppStore.setState({
      previewProjectAdoption: async ({ rootPath }) =>
        rootPath === PAYMENTS.rootPath
          ? { project: PAYMENTS, sourceWorkspace: NORTHWIND, sessionCount: 3, isShell: false }
          : null,
    });
  }
};

export const NewWorkspaceScene = ({ state, theme }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    applyDocumentTheme({ theme });
    seed({ state });
    setIsReady(true);
  }, [state, theme]);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    const timer = window.setTimeout(() => {
      if (state === 'scratch') {
        fillScratchName();
        return;
      }
      if (PICK[state] !== null) {
        clickChooseFolder();
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [isReady, state]);

  if (!isReady) {
    return null;
  }
  return (
    <main className="flex h-screen w-screen justify-center overflow-hidden bg-background text-foreground">
      <div className="flex w-full max-w-[600px] flex-col" style={{ paddingTop: COLUMN_TOP_PX }}>
        <NewWorkspaceForm
          mode="first-run"
          start={state === 'scratch' ? 'scratch' : 'folder'}
          onCancel={() => undefined}
        />
      </div>
    </main>
  );
};
