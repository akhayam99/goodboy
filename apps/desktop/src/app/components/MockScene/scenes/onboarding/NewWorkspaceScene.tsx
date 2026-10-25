import { useEffect, useState } from 'react';
import type { InvokeArgs } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import {
  brandId,
  type FolderSignals,
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
import { mockIPC } from '@tauri-apps/api/mocks';
import { sceneIpcAnswer } from '../sceneIpcAnswer';

export type NewWorkspaceSceneState =
  | 'empty'
  | 'likely'
  | 'repo'
  | 'many'
  | 'plain'
  | 'conflict'
  | 'denied'
  | 'scratch'
  | 'clone'
  | 'cloning'
  | 'clone-auth';

type Props = {
  readonly state: NewWorkspaceSceneState;
  readonly theme: 'dark' | 'light';
};

const clock = sceneClock({ anchor: '2026-10-17T09:00:00.000Z' });
const NOW = clock.iso({ at: '2026-10-17T09:00:00.000Z' });

const HOME = '/mock';
const CODE = `${HOME}/Code`;
const WORK = `${HOME}/work`;
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

const ACME_DOCS_SIGNALS: FolderSignals = {
  path: ACME_DOCS,
  markers: [],
  counts: {
    markdown: 24,
    text: 0,
    pdf: 6,
    word: 0,
    pages: 0,
    keynote: 0,
    numbers: 0,
    excel: 0,
    powerpoint: 0,
    image: 0,
    video: 0,
    audio: 0,
    source: 0,
    other: 0,
  },
  totalFiles: 30,
  totalBytes: 18_000_000,
  entriesRead: 30,
  isTruncated: false,
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
  [CODE]: plainAt({ path: CODE }),
  [WORK]: plainAt({ path: WORK }),
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

const notFoundAt = ({ path }: PathParams): GitRepoCheck => ({
  isRepo: false,
  rootPath: null,
  resolvedPath: null,
  defaultBranch: null,
  error: `path does not exist: ${path}`,
  errorKind: 'not_found',
});

const isDirectlyUnderHome = ({ path }: PathParams): boolean =>
  path.startsWith(`${HOME}/`) && !path.slice(HOME.length + 1).includes('/');

const HARBORLINE_REPOS = [
  { name: 'payments-api', path: `${HARBORLINE}/payments-api`, defaultBranch: 'main' },
  { name: 'ledger-core', path: `${HARBORLINE}/ledger-core`, defaultBranch: 'main' },
  { name: 'notify-relay', path: `${HARBORLINE}/notify-relay`, defaultBranch: 'develop' },
];

const PICK = {
  empty: null,
  likely: null,
  repo: ACME_WEB,
  many: HARBORLINE,
  plain: ACME_DOCS,
  conflict: HARBORLINE,
  denied: DENIED,
  scratch: null,
  clone: null,
  cloning: null,
  'clone-auth': null,
} as const satisfies Record<NewWorkspaceSceneState, string | null>;

const CLONE_ADDRESS = 'https://github.com/Northwind/ledger-core';
const CLONE_OWNER_NAME = 'Northwind/ledger-core';
const CLONE_PROGRESS = { phase: 'Receiving objects', percent: 45 };

let cloneRequestId = '';

const COLUMN_TOP_PX = 116;

type AnswerParams = {
  readonly state: NewWorkspaceSceneState;
};

type PayloadParams = {
  readonly payload: InvokeArgs | undefined;
};

const pathOf = ({ payload }: PayloadParams): string => {
  if (payload === undefined || Array.isArray(payload) || payload instanceof ArrayBuffer) {
    return '';
  }
  if (payload instanceof Uint8Array) {
    return '';
  }
  const path = payload['path'];
  return typeof path === 'string' ? path : '';
};

const requestIdOf = ({ payload }: PayloadParams): string => {
  if (payload === undefined || Array.isArray(payload) || payload instanceof ArrayBuffer) {
    return '';
  }
  if (payload instanceof Uint8Array) {
    return '';
  }
  const requestId = payload['requestId'];
  return typeof requestId === 'string' ? requestId : '';
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
        return (
          CHECKS[pathOf({ payload })] ??
          (isDirectlyUnderHome({ path: pathOf({ payload }) })
            ? notFoundAt({ path: pathOf({ payload }) })
            : plainAt({ path: pathOf({ payload }) }))
        );
      case 'scan_child_repos':
        return pathOf({ payload }) === HARBORLINE ? HARBORLINE_REPOS : [];
      case 'repo_identity':
        return { rootCommits: [], remoteUrl: null };
      case 'read_folder_signals':
        return pathOf({ payload }) === ACME_DOCS ? ACME_DOCS_SIGNALS : null;
      case 'clone_probe':
        return state === 'clone-auth'
          ? Promise.reject({ kind: 'auth_refused', message: 'no login' })
          : { route: 'git', host: 'github', name: 'ledger-core' };
      case 'clone_repository':
        cloneRequestId = requestIdOf({ payload });
        return new Promise<never>(() => undefined);
      case 'clone_cancel':
      case 'clone_free_destination':
        return null;
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

const tickCode = (): boolean => {
  const box = document.querySelector<HTMLInputElement>('[aria-label="Look in ~/Code"]');
  box?.click();
  return box !== null;
};

type ClickParams = {
  readonly selector: string;
  readonly text: string;
};

const clickByText = ({ selector, text }: ClickParams): void => {
  Array.from(document.querySelectorAll<HTMLElement>(selector))
    .find((candidate) => candidate.textContent?.trim() === text)
    ?.click();
};

const fillCloneAddress = ({ state }: AnswerParams): void => {
  const input = document.querySelector<HTMLInputElement>('input[placeholder^="owner/name"]');
  if (input === null) {
    return;
  }
  typeInto({ input, text: state === 'clone' ? CLONE_OWNER_NAME : CLONE_ADDRESS });
};

const driveClone = ({ state }: AnswerParams): (() => void) => {
  const timers = [
    window.setTimeout(() => clickByText({ selector: 'form button', text: 'Clone it' }), 150),
    window.setTimeout(() => fillCloneAddress({ state }), 300),
    window.setTimeout(() => {
      if (state === 'clone') {
        clickByText({ selector: '[role="tab"]', text: 'GitHub' });
        return;
      }
      clickByText({ selector: 'form button', text: 'Clone' });
    }, 450),
  ];
  const poll =
    state === 'cloning'
      ? window.setInterval(() => {
          if (cloneRequestId !== '') {
            void emit('clone-progress', { requestId: cloneRequestId, ...CLONE_PROGRESS });
          }
        }, 200)
      : null;
  return () => {
    timers.forEach((timer) => window.clearTimeout(timer));
    if (poll !== null) {
      window.clearInterval(poll);
    }
  };
};

const fillScratchName = (): void => {
  const input = document.querySelector<HTMLInputElement>('input[placeholder="acme-api"]');
  if (input !== null) {
    typeInto({ input, text: 'acme-api' });
  }
};

const seed = ({ state }: AnswerParams): void => {
  cloneRequestId = '';
  mockIPC(sceneIpcAnswer({ handler: answerFor({ state }) }), {
    shouldMockEvents: state === 'cloning',
  });
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
    if (state === 'clone' || state === 'cloning' || state === 'clone-auth') {
      return driveClone({ state });
    }
    if (state === 'likely') {
      const poll = window.setInterval(() => {
        if (tickCode()) {
          window.clearInterval(poll);
        }
      }, 150);
      return () => window.clearInterval(poll);
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
