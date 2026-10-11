import type { Project, ProjectId } from '@goodboy/types';
import { scriptPinId } from '../../../../../../features/scripts/scriptPinId';
import { scriptPinsKey } from '../../../../../../features/scripts/scriptPinsKey';
import type { ScriptGroup } from '../../../../../../features/scripts/scripts';
import type { ProjectRootScripts } from '../../../../../../store/slices/scripts/state';
import { useAppStore } from '../../../../../../store';
import { sceneClock } from '../../../sceneClock';
import { SETTINGS_WORKSPACE, SETTINGS_WORKSPACE_ID } from '../../audit/settingsSeed';

export type SettingsProjectsVariant = 'rows' | 'open' | 'failed' | 'nostar';

const clock = sceneClock({ anchor: '2026-09-22T10:12:00.000Z' });
const NOW = clock.iso({ at: '2026-09-22T10:12:00.000Z' });

type ProjectParams = {
  readonly name: string;
  readonly isStarred: boolean;
  readonly kind?: Project['kind'];
  readonly description?: string;
};

const projectOf = ({ name, isStarred, kind = 'repo', description }: ProjectParams): Project => ({
  id: `mock-settings-projects-${name}` as ProjectId,
  workspaceId: SETTINGS_WORKSPACE_ID,
  name,
  rootPath: `/mock/harborline/${name}`,
  kind,
  baseBranch: kind === 'repo' ? 'main' : null,
  description: description ?? null,
  ...(isStarred ? { starredAt: NOW } : {}),
  overrides: SETTINGS_WORKSPACE.overrides,
  createdAt: NOW,
  updatedAt: NOW,
});

const PROJECT_PARAMS: ReadonlyArray<ProjectParams> = [
  { name: 'ledger-core', isStarred: true, description: 'Settles payments and writes the ledger' },
  { name: 'payments-api', isStarred: true, description: 'Public API in front of ledger-core' },
  { name: 'notify-relay', isStarred: true },
  { name: 'cascadia-web', isStarred: true, description: 'Customer portal' },
  { name: 'acme-infra', isStarred: false },
  { name: 'northwind-docs', isStarred: false, kind: 'folder', description: 'Public docs' },
  { name: 'harborline-app', isStarred: false },
  { name: 'orbit-sdk', isStarred: false },
  { name: 'runbooks', isStarred: false, kind: 'folder', description: 'On-call runbooks' },
  { name: 'ops-scripts', isStarred: false },
];

export const projectsOf = ({
  isStarredShown,
}: {
  readonly isStarredShown: boolean;
}): ReadonlyArray<Project> =>
  PROJECT_PARAMS.map((params) =>
    projectOf({ ...params, isStarred: isStarredShown && params.isStarred }),
  );

const LEDGER_SCRIPTS: ScriptGroup = {
  source: 'package-json',
  packageName: 'ledger-core',
  relDir: '',
  manager: 'pnpm',
  scripts: [
    { name: 'dev', command: 'pnpm run dev', body: 'vite --port 4310' },
    { name: 'build', command: 'pnpm run build', body: 'tsc -b && vite build' },
    { name: 'test', command: 'pnpm run test', body: 'vitest run' },
    { name: 'db:migrate', command: 'pnpm run db:migrate', body: 'node scripts/migrate.mjs' },
  ],
};

const LEDGER_PATH = '/mock/harborline/ledger-core';

const ready: ProjectRootScripts = { status: 'ready', groups: [LEDGER_SCRIPTS], error: null };

const failed: ProjectRootScripts = {
  status: 'error',
  groups: [],
  error: 'Permission denied reading /mock/harborline/ledger-core',
};

type SeedParams = {
  readonly variant: SettingsProjectsVariant;
};

const seedFor =
  ({ variant }: SeedParams) =>
  (): void => {
    useAppStore.setState((state) => ({
      projects: projectsOf({ isStarredShown: variant !== 'nostar' }),
      projectRootScripts: { [LEDGER_PATH]: variant === 'failed' ? failed : ready },
      terminalFolderOverrides: {},
      settings: {
        ...state.settings,
        [scriptPinsKey({ projectId: 'mock-settings-projects-ledger-core' as ProjectId })]:
          JSON.stringify([
            scriptPinId({ source: 'package-json', relDir: '', name: 'dev', savedId: null }),
            scriptPinId({ source: 'package-json', relDir: '', name: 'test', savedId: null }),
          ]),
      },
      loadScriptPins: async () => undefined,
      loadProjectRootScripts: async () => undefined,
      loadProjectGitStatus: async () => undefined,
      checkGoodboyIgnore: async () => undefined,
      loadTerminalWorkspaceFolder: async () => undefined,
    }));
  };

export const SETTINGS_PROJECTS_SEEDS = {
  rows: seedFor({ variant: 'rows' }),
  open: seedFor({ variant: 'open' }),
  failed: seedFor({ variant: 'failed' }),
  nostar: seedFor({ variant: 'nostar' }),
} as const satisfies Record<SettingsProjectsVariant, () => void>;
