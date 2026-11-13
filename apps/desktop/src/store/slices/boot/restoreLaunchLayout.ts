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
import type { LaunchReads } from '../workspaces/launchReads';
import { openLaunchWorkspace } from './openLaunchWorkspace';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly workspaces: ReadonlyArray<Workspace>;
  readonly isReopenLast: boolean;
  readonly launch: LaunchReads;
};

export type LaunchLayout = {
  readonly isRestored: boolean;
  readonly secondary: ReadonlyArray<WindowLayout & { readonly title: string }>;
};

const NOTHING_RESTORED: LaunchLayout = { isRestored: false, secondary: [] };

type ApplyParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly layout: WindowLayout;
  readonly workspace: Workspace;
  readonly launch: LaunchReads;
};

const applyLayout = async ({ set, get, layout, workspace, launch }: ApplyParams): Promise<void> => {
  const { isLatest, failure } = await openLaunchWorkspace({ set, get, id: workspace.id, launch });
  void setWindowTitle(workspace.name);
  if (!isLatest || failure !== null) {
    return;
  }
  await get().restoreLocation({ location: layout.location });
};

export const restoreLaunchLayout = async ({
  set,
  get,
  workspaces,
  isReopenLast,
  launch,
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
    await applyLayout({ set, get, layout, workspace, launch });
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
    await applyLayout({ set, get, layout: main, workspace: mainWorkspace, launch });
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
