import type { Project, Workspace, WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { folderCountLabel } from '../../workspace/folderCountLabel';
import type { PaletteEntry } from '../types';

type OpenParams = {
  readonly id: WorkspaceId;
  readonly title: string;
  readonly onRunning: 'new-window';
};

type Params = {
  readonly workspaces: ReadonlyArray<Workspace>;
  readonly projects: ReadonlyArray<Project>;
  readonly open: (params: OpenParams) => Promise<unknown>;
};

export const workspaceEntries = ({
  workspaces,
  projects,
  open,
}: Params): ReadonlyArray<PaletteEntry> =>
  workspaces.map((workspace) => ({
    key: `workspace:${workspace.id}`,
    label: workspace.name,
    kind: 'workspace',
    group: 'workspace',
    icon: CONCEPT_ICONS.workspace,
    detail: folderCountLabel({ projects, workspaceId: workspace.id }),
    tag: 'Workspace',
    run: () => void open({ id: workspace.id, title: workspace.name, onRunning: 'new-window' }),
  }));
