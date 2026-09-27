import type { Workspace } from '@goodboy/types';
import {
  MAIN_WINDOW_LABEL,
  isMainWindow,
  restoreKeyFromHash,
  setWindowTitle,
  targetWorkspaceFromHash,
} from '../../../features/workspace/window';
import {
  forgetWindowLayout,
  listWindowLayouts,
  type WindowLayout,
} from '../../../features/workspace/windowLayout';
import { readRecentRestartReason } from '../turn/restartMarker';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly workspaces: ReadonlyArray<Workspace>;
  readonly isReopenLast: boolean;
};

export type LaunchLayout = {
  readonly isRestored: boolean;
  readonly secondary: ReadonlyArray<WindowLayout & { readonly title: string }>;
};

const NOTHING_RESTORED: LaunchLayout = { isRestored: false, secondary: [] };

type ApplyParams = {
  readonly get: GetFn;
  readonly layout: WindowLayout;
  readonly workspace: Workspace;
};

const applyLayout = async ({ get, layout, workspace }: ApplyParams): Promise<void> => {
  await get().setCurrentWorkspace(workspace.id);
  void setWindowTitle(workspace.name);
  get().restoreLocation({ location: layout.location });
};

export const restoreLaunchLayout = async ({
  get,
  workspaces,
  isReopenLast,
}: Params): Promise<LaunchLayout> => {
  const nowMs = Date.now();
  const restoreKey = restoreKeyFromHash();
  if (restoreKey !== null) {
    const layouts = await listWindowLayouts({ nowMs });
    const layout = layouts.find((candidate) => candidate.label === restoreKey);
    await forgetWindowLayout({ label: restoreKey });
    const workspace = workspaces.find((candidate) => candidate.id === layout?.workspaceId);
    if (layout === undefined || workspace === undefined) {
      return NOTHING_RESTORED;
    }
    await applyLayout({ get, layout, workspace });
    return { isRestored: true, secondary: [] };
  }
  if (!isMainWindow() || targetWorkspaceFromHash() !== null) {
    return NOTHING_RESTORED;
  }
  const layouts = await listWindowLayouts({ nowMs });
  const others = layouts.filter((layout) => layout.label !== MAIN_WINDOW_LABEL);
  const isRestartedByApp = (await readRecentRestartReason({ nowMs })) !== null;
  if (!isReopenLast && !isRestartedByApp) {
    await Promise.all(others.map((layout) => forgetWindowLayout({ label: layout.label })));
    return NOTHING_RESTORED;
  }
  const main = layouts.find((layout) => layout.label === MAIN_WINDOW_LABEL);
  const mainWorkspace = workspaces.find((workspace) => workspace.id === main?.workspaceId);
  if (main !== undefined && mainWorkspace !== undefined) {
    await applyLayout({ get, layout: main, workspace: mainWorkspace });
  }
  const opened = new Set(mainWorkspace === undefined ? [] : [mainWorkspace.id]);
  const secondary: Array<WindowLayout & { readonly title: string }> = [];
  for (const layout of others) {
    const workspace = workspaces.find((candidate) => candidate.id === layout.workspaceId);
    if (workspace === undefined || opened.has(workspace.id)) {
      await forgetWindowLayout({ label: layout.label });
      continue;
    }
    opened.add(workspace.id);
    secondary.push({ ...layout, title: workspace.name });
  }
  return { isRestored: mainWorkspace !== undefined, secondary };
};
