import { useEffect, useState } from 'react';
import {
  brandId,
  type Project,
  type ProjectId,
  type Workspace,
  type WorkspaceId,
} from '@goodboy/types';
import { WorkspaceLauncher } from '../../../../../features/workspace/components/WorkspaceLauncher';
import { SETTING_REOPEN_LAST } from '../../../../../features/settings/settings';
import {
  enterWizardStep,
  hydrateOnboardingFromDb,
  markStepComplete,
  pauseWizard,
} from '../../../../../features/onboarding/onboarding-store';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import { mockSceneIpc } from '../mockSceneIpc';

export type HomeSceneState = 'list' | 'new' | 'empty';

type Props = {
  readonly state: HomeSceneState;
  readonly theme: 'dark' | 'light';
};

const clock = sceneClock({ anchor: '2026-10-17T09:00:00.000Z' });
const NOW = clock.iso({ at: '2026-10-17T09:00:00.000Z' });

const HOME = '/mock';
const CODE = `${HOME}/Code`;

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

type WorkspaceParams = {
  readonly name: string;
  readonly slug: string;
  readonly lastAt: string;
};

const workspaceOf = ({ name, slug, lastAt }: WorkspaceParams): Workspace => ({
  id: brandId<WorkspaceId>({ value: `mock-workspace-${slug}` }),
  name,
  slug,
  overrides: OVERRIDES,
  createdAt: NOW,
  updatedAt: NOW,
  lastAccessedAt: clock.iso({ at: lastAt }),
});

const HARBORLINE = workspaceOf({
  name: 'Harborline',
  slug: 'harborline',
  lastAt: '2026-10-17T07:40:00.000Z',
});
const NORTHWIND = workspaceOf({
  name: 'Northwind',
  slug: 'northwind',
  lastAt: '2026-10-16T16:10:00.000Z',
});
const ACME_WEB = workspaceOf({
  name: 'Acme web',
  slug: 'acme-web',
  lastAt: '2026-10-14T11:00:00.000Z',
});
const CASCADIA = workspaceOf({
  name: 'Cascadia',
  slug: 'cascadia',
  lastAt: '2026-10-09T15:30:00.000Z',
});

type FolderParams = {
  readonly workspace: Workspace;
  readonly path: string;
};

const folderOf = ({ workspace, path }: FolderParams): Project => ({
  id: brandId<ProjectId>({ value: `mock-project-${path.replaceAll('/', '-')}` }),
  workspaceId: workspace.id,
  name: path.split('/').at(-1) ?? path,
  rootPath: `${CODE}/${path}`,
  kind: 'repo',
  overrides: OVERRIDES,
  createdAt: NOW,
  updatedAt: NOW,
});

const FOLDERS: ReadonlyArray<Project> = [
  ...['payments-api', 'ledger-core', 'notify-relay'].map((name) =>
    folderOf({ workspace: HARBORLINE, path: `harborline/${name}` }),
  ),
  ...['web', 'api'].map((name) => folderOf({ workspace: NORTHWIND, path: `northwind/${name}` })),
  folderOf({ workspace: ACME_WEB, path: 'acme-web' }),
  ...['atlas', 'gateway', 'ingest', 'console'].map((name) =>
    folderOf({ workspace: CASCADIA, path: `cascadia/${name}` }),
  ),
];

const answer = (command: string): unknown => {
  switch (command) {
    case 'plugin:path|resolve_directory':
      return HOME;
    default:
      return null;
  }
};

type SeedParams = {
  readonly state: HomeSceneState;
};

const pauseAtWorkspace = async (): Promise<void> => {
  await hydrateOnboardingFromDb();
  markStepComplete('agents');
  await enterWizardStep({ step: 'workspace' });
  await pauseWizard();
};

const seed = ({ state }: SeedParams): void => {
  mockSceneIpc(answer);
  const isEmpty = state === 'empty';
  useAppStore.setState({
    hydrated: true,
    workspaces: isEmpty ? [] : [HARBORLINE, NORTHWIND, ACME_WEB, CASCADIA],
    currentWorkspaceId: null,
    currentSessionId: null,
    projects: isEmpty ? [] : FOLDERS,
    settings: { [SETTING_REOPEN_LAST]: '1' },
  });
  void (isEmpty ? pauseAtWorkspace() : hydrateOnboardingFromDb());
};

const noop = () => undefined;

export const HomeScene = ({ state, theme }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    applyDocumentTheme({ theme });
    seed({ state });
    setIsReady(true);
  }, [state, theme]);

  if (!isReady) {
    return null;
  }
  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground">
      <WorkspaceLauncher isCreating={state === 'new'} onCloseCreate={noop} onOfferRepo={noop} />
    </div>
  );
};
