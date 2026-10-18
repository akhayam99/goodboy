import {
  brandId,
  type Project,
  type ProjectId,
  type Workspace,
  type WorkspaceId,
} from '@goodboy/types';
import { sceneClock } from '../../sceneClock';
import { SETTINGS_WORKSPACE, SETTINGS_WORKSPACE_ID } from '../audit/settingsSeed';

const clock = sceneClock({ anchor: '2026-10-17T14:02:00.000Z' });
const NOW = clock.iso({ at: '2026-10-17T14:02:00.000Z' });
const HOME = '/mock';

type WorkspaceParams = {
  readonly name: string;
  readonly slug: string;
  readonly lastAt: string;
};

const workspaceOf = ({ name, slug, lastAt }: WorkspaceParams): Workspace => ({
  id: brandId<WorkspaceId>({ value: `mock-nogit-workspace-${slug}` }),
  name,
  slug,
  overrides: SETTINGS_WORKSPACE.overrides,
  createdAt: NOW,
  updatedAt: NOW,
  lastAccessedAt: clock.iso({ at: lastAt }),
});

const HARBORLINE = workspaceOf({
  name: 'Harborline',
  slug: 'harborline',
  lastAt: '2026-10-17T13:40:00.000Z',
});
const ACME_WEB = workspaceOf({
  name: 'Acme web',
  slug: 'acme-web',
  lastAt: '2026-10-17T11:10:00.000Z',
});
const ACME_NOTES = workspaceOf({
  name: 'Acme notes',
  slug: 'acme-notes',
  lastAt: '2026-10-16T18:20:00.000Z',
});
const NORTHWIND = workspaceOf({
  name: 'Northwind',
  slug: 'northwind',
  lastAt: '2026-10-15T09:30:00.000Z',
});

type FolderParams = {
  readonly workspaceId: WorkspaceId;
  readonly path: string;
  readonly kind: Project['kind'];
};

const folderOf = ({ workspaceId, path, kind }: FolderParams): Project => ({
  id: brandId<ProjectId>({ value: `mock-nogit-project-${path.replaceAll('/', '-')}` }),
  workspaceId,
  name: path.split('/').at(-1) ?? path,
  rootPath: `${HOME}/${path}`,
  kind,
  baseBranch: kind === 'repo' ? 'main' : null,
  overrides: SETTINGS_WORKSPACE.overrides,
  createdAt: NOW,
  updatedAt: NOW,
});

export const FOLDERS_HOME_WEB = folderOf({
  workspaceId: ACME_WEB.id,
  path: 'Code/acme-web',
  kind: 'folder',
});
export const FOLDERS_HOME_NOTES = folderOf({
  workspaceId: ACME_NOTES.id,
  path: 'Documents/acme-notes',
  kind: 'folder',
});

export const FOLDERS_HOME: ReadonlyArray<Project> = [
  ...['payments-api', 'ledger-core', 'notify-relay'].map((name) =>
    folderOf({ workspaceId: HARBORLINE.id, path: `Code/harborline/${name}`, kind: 'repo' }),
  ),
  FOLDERS_HOME_WEB,
  FOLDERS_HOME_NOTES,
  ...['web', 'api'].map((name) =>
    folderOf({ workspaceId: NORTHWIND.id, path: `Code/northwind/${name}`, kind: 'repo' }),
  ),
];

export const FOLDERS_SETTINGS_NOTES: Project = {
  ...FOLDERS_HOME_NOTES,
  workspaceId: SETTINGS_WORKSPACE_ID,
};

export const FOLDERS_HOME_WORKSPACES: ReadonlyArray<Workspace> = [
  HARBORLINE,
  ACME_WEB,
  ACME_NOTES,
  NORTHWIND,
];
