import { useEffect, useState } from 'react';
import type { InvokeArgs } from '@tauri-apps/api/core';
import type { FirstCommitPlan, FolderFileKind, FolderSignals, GitRepoCheck } from '@goodboy/types';
import { NewWorkspaceForm } from '../../../../../shared/components/NewWorkspaceForm';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { SETTING_NEW_PROJECT_PARENT } from '../../../../../features/settings/settings';
import { useAppStore } from '../../../../../store';
import { mockSceneIpc } from '../mockSceneIpc';

export type PickSceneState = 'code' | 'docs' | 'inside' | 'big';

type Props = {
  readonly state: PickSceneState;
  readonly theme: 'dark' | 'light';
};

const HOME = '/mock';
const ACME_WEB = `${HOME}/Code/acme-web`;
const ACME_NOTES = `${HOME}/Documents/acme-notes`;
const HARBORLINE = `${HOME}/Code/harborline`;
const HANDBOOK = `${HARBORLINE}/handbook`;
const ACME_RESEARCH = `${HOME}/Documents/acme-research`;
const GB = 1024 * 1024 * 1024;

const PICK = {
  code: ACME_WEB,
  docs: ACME_NOTES,
  inside: HANDBOOK,
  big: ACME_RESEARCH,
} as const satisfies Record<PickSceneState, string>;

const NO_FILES: Readonly<Record<FolderFileKind, number>> = {
  markdown: 0,
  text: 0,
  pdf: 0,
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
};

type SignalsParams = {
  readonly path: string;
  readonly counts: Partial<Record<FolderFileKind, number>>;
  readonly totalBytes: number;
  readonly markers?: FolderSignals['markers'];
};

const signalsOf = ({ path, counts, totalBytes, markers = [] }: SignalsParams): FolderSignals => {
  const all = { ...NO_FILES, ...counts };
  const totalFiles = Object.values(all).reduce((total, count) => total + count, 0);
  return {
    path,
    markers,
    counts: all,
    totalFiles,
    totalBytes,
    entriesRead: totalFiles,
    isTruncated: false,
  };
};

const SIGNALS: Readonly<Record<string, FolderSignals>> = {
  [ACME_WEB]: signalsOf({
    path: ACME_WEB,
    markers: ['package.json'],
    counts: { source: 214, markdown: 3 },
    totalBytes: 9_000_000,
  }),
  [ACME_NOTES]: signalsOf({
    path: ACME_NOTES,
    counts: { markdown: 86, pdf: 12 },
    totalBytes: 42_000_000,
  }),
  [ACME_RESEARCH]: signalsOf({
    path: ACME_RESEARCH,
    counts: { video: 520, pdf: 80, markdown: 40 },
    totalBytes: 38 * GB,
  }),
};

const FIRST_COMMIT: FirstCommitPlan = {
  rootPath: ACME_WEB,
  start: 'no_git',
  branch: 'main',
  author: { name: 'Dana Reyes', email: 'dana@acme.dev', isFallback: false },
  hasIgnoreFile: false,
  entries: [
    {
      key: 'src/',
      kind: 'included',
      files: 214,
      sample: ['src/'],
      isLeftOut: false,
      canToggle: false,
      ignore: null,
    },
  ],
};

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
  [HANDBOOK]: {
    isRepo: true,
    rootPath: HARBORLINE,
    resolvedPath: HANDBOOK,
    defaultBranch: 'main',
    error: null,
    errorKind: null,
  },
};

const pathOf = (payload: InvokeArgs | undefined): string => {
  if (
    payload === undefined ||
    Array.isArray(payload) ||
    payload instanceof ArrayBuffer ||
    payload instanceof Uint8Array
  ) {
    return '';
  }
  const path = payload['path'];
  return typeof path === 'string' ? path : '';
};

type AnswerParams = {
  readonly state: PickSceneState;
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
        return [];
      case 'repo_identity':
        return { rootCommits: [], remoteUrl: null };
      case 'read_folder_signals':
        return SIGNALS[pathOf(payload)] ?? null;
      case 'folder_git_first_commit_plan':
        return FIRST_COMMIT;
      default:
        return null;
    }
  };

const clickChooseFolder = (): void => {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>('form button')).find(
    (candidate) => candidate.textContent?.startsWith('Choose folder') === true,
  );
  button?.click();
};

const COLUMN_TOP_PX = 116;

export const PickScene = ({ state, theme }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    applyDocumentTheme({ theme });
    mockSceneIpc(answerFor({ state }));
    useAppStore.setState({
      hydrated: true,
      workspaces: [],
      currentWorkspaceId: null,
      projects: [],
      settings: { [SETTING_NEW_PROJECT_PARENT]: `${HOME}/Code` },
    });
    setIsReady(true);
  }, [state, theme]);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    const timer = window.setTimeout(clickChooseFolder, 150);
    return () => window.clearTimeout(timer);
  }, [isReady]);

  if (!isReady) {
    return null;
  }
  return (
    <main className="flex h-screen w-screen justify-center overflow-hidden bg-background text-foreground">
      <div className="flex w-full max-w-[600px] flex-col" style={{ paddingTop: COLUMN_TOP_PX }}>
        <NewWorkspaceForm mode="first-run" onCancel={() => undefined} />
      </div>
    </main>
  );
};
