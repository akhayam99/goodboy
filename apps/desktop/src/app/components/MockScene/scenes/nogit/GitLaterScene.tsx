import { useCallback, useEffect } from 'react';
import {
  brandId,
  type FirstCommitEntry,
  type FirstCommitPlan,
  type FolderGitProbe,
  type Project,
  type ProjectId,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { FolderGitNotice } from '../../../../../store/slices/folder-purpose/state';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { sceneClock } from '../../sceneClock';
import { SettingsFrame } from '../audit/SettingsFrame';
import { SETTINGS_WORKSPACE, SETTINGS_WORKSPACE_ID } from '../audit/settingsSeed';

export type GitLaterState = 'none' | 'review' | 'tracked' | 'detected' | 'empty';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly state: GitLaterState;
};

const clock = sceneClock({ anchor: '2026-10-17T14:02:00.000Z' });
const NOW = clock.iso({ at: '2026-10-17T14:02:00.000Z' });

const WEB_ID = brandId<ProjectId>({ value: 'mock-nogit-project-acme-web' });
const WEB_PATH = '/mock/Code/acme-web';

const WEB: Project = {
  id: WEB_ID,
  workspaceId: SETTINGS_WORKSPACE_ID,
  name: 'acme-web',
  rootPath: WEB_PATH,
  kind: 'folder',
  baseBranch: null,
  description: 'Marketing site',
  overrides: SETTINGS_WORKSPACE.overrides,
  createdAt: NOW,
  updatedAt: NOW,
};

type EntryParams = {
  readonly key: string;
  readonly kind: FirstCommitEntry['kind'];
  readonly files: number;
  readonly sample?: ReadonlyArray<string>;
};

const entry = ({ key, kind, files, sample = [key] }: EntryParams): FirstCommitEntry => ({
  key,
  kind,
  files,
  sample,
  isLeftOut: kind !== 'included',
  canToggle: kind === 'dependencies' || kind === 'output',
  ignore: kind === 'included' ? null : `/${key}`,
});

const PLAN: FirstCommitPlan = {
  rootPath: WEB_PATH,
  start: 'no_git',
  branch: 'main',
  author: { name: 'Dana Reyes', email: 'dana@acme.dev', isFallback: false },
  hasIgnoreFile: false,
  entries: [
    entry({ key: 'src/', kind: 'included', files: 196 }),
    entry({ key: 'public/', kind: 'included', files: 12 }),
    entry({
      key: '.',
      kind: 'included',
      files: 6,
      sample: ['package.json', 'tsconfig.json', 'README.md'],
    }),
    entry({ key: 'node_modules/', kind: 'dependencies', files: 1204 }),
    entry({ key: 'dist/', kind: 'output', files: 38 }),
    entry({ key: '.env*', kind: 'secret', files: 1, sample: ['.env'] }),
  ],
};

type ProbeParams = {
  readonly state: FolderGitProbe['state'];
  readonly commitCount: number;
};

const probeOf = ({ state, commitCount }: ProbeParams): FolderGitProbe => ({
  path: WEB_PATH,
  state,
  rootPath: state === 'none' ? null : WEB_PATH,
  branch: state === 'none' ? null : 'main',
  commitCount,
  remoteUrl: null,
});

type SceneSeed = {
  readonly kind: Project['kind'];
  readonly probe: FolderGitProbe;
  readonly notice: FolderGitNotice | null;
};

const SEEDS: Readonly<Record<GitLaterState, SceneSeed>> = {
  none: { kind: 'folder', probe: probeOf({ state: 'none', commitCount: 0 }), notice: null },
  review: { kind: 'folder', probe: probeOf({ state: 'none', commitCount: 0 }), notice: null },
  tracked: { kind: 'repo', probe: probeOf({ state: 'tracked', commitCount: 1 }), notice: null },
  detected: {
    kind: 'repo',
    probe: probeOf({ state: 'tracked', commitCount: 3 }),
    notice: { kind: 'switched', foundAt: NOW, commitCount: 3, branch: 'main' },
  },
  empty: { kind: 'folder', probe: probeOf({ state: 'empty', commitCount: 0 }), notice: null },
};

export const GitLaterScene = ({ theme, state }: Props) => {
  const seed = useCallback(() => {
    applyDocumentTheme({ theme });
    const { kind, probe, notice } = SEEDS[state];
    useAppStore.setState({
      projects: [{ ...WEB, kind, baseBranch: kind === 'repo' ? 'main' : null }],
      folderPurpose: { [WEB_ID]: 'code' },
      folderGit: { [WEB_ID]: probe },
      folderGitNotice: notice === null ? {} : { [WEB_ID]: notice },
      folderGitChoice: {},
      firstCommitPlans: { [WEB_ID]: PLAN },
      probeFolderGit: async () => probe,
      loadFirstCommitPlan: async () => PLAN,
      loadProjectGitStatus: async () => undefined,
      loadProjectRootScripts: async () => undefined,
      loadScriptPins: async () => undefined,
      checkGoodboyIgnore: async () => undefined,
      loadTerminalWorkspaceFolder: async () => undefined,
    });
  }, [theme, state]);

  useEffect(() => {
    applyDocumentTheme({ theme });
  }, [theme]);

  return (
    <SettingsFrame
      focus={{
        scope: 'workspace',
        section: state === 'review' ? 'track-with-git' : 'projects',
      }}
      seed={seed}
    />
  );
};
