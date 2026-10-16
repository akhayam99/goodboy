import { getSetting } from '@goodboy/db';
import { invokeTerminalListLive } from '../../../features/terminal/terminal';
import { terminalOutputBus } from '../../../features/terminal/outputBus';
import { tauriDatabase } from '../../../shared/lib/db';
import type { TerminalTab, TerminalTabId } from '../../../shared/types/terminal';
import { exitCapture } from './exitCapture';
import { markTerminalTabsLoaded, saveTerminalTabs } from './saveTerminalTabs';
import {
  SETTING_TERMINAL_TABS,
  parseSavedTerminalTabs,
  type SavedTerminalTabs,
} from './savedTerminalTabs';
import { SETTING_TERMINAL_NAMES } from './state';
import { DEFAULT_TERMINAL_NAME, parseTerminalId, terminalOwnerKey } from './terminalOwner';
import { terminalWorktreeKeyIn } from './terminalWorktree';
import type { GetFn, SetFn } from './types';
import { watchTerminalExits } from './watchTerminalExits';

type PushParams = {
  readonly tab: TerminalTab;
};

const isNameRecord = (value: unknown): value is Record<string, string> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every((entry) => typeof entry === 'string');

const readNames = async (): Promise<Record<string, string>> => {
  try {
    const raw = await getSetting(tauriDatabase, SETTING_TERMINAL_NAMES);
    if (raw === null || raw === undefined || raw === '') {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    return isNameRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const readSaved = async (): Promise<SavedTerminalTabs | null> => {
  try {
    const raw = await getSetting(tauriDatabase, SETTING_TERMINAL_TABS);
    if (raw === null || raw === undefined || raw === '') {
      return null;
    }
    return parseSavedTerminalTabs({ raw });
  } catch {
    return null;
  }
};

type OrdinalsParams = {
  readonly saved: SavedTerminalTabs | null;
  readonly rebuilt: ReadonlyMap<string, readonly TerminalTab[]>;
};

type OrdinalIdParams = {
  readonly id: string;
};

const ordinalOfId = ({ id }: OrdinalIdParams): number => {
  const parsed = Number.parseInt(id.slice(id.lastIndexOf('t') + 1), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const ordinalsOf = ({ saved, rebuilt }: OrdinalsParams): Record<string, number> => {
  const ordinals: Record<string, number> = { ...saved?.ordinals };
  for (const [key, tabs] of rebuilt) {
    const highest = Math.max(0, ...tabs.map((tab) => ordinalOfId({ id: tab.id })));
    ordinals[key] = Math.max(ordinals[key] ?? 0, highest);
  }
  return ordinals;
};

export const reattachTerminalTabs = (set: SetFn, get: GetFn) => {
  return async (): Promise<void> => {
    await terminalOutputBus.register();
    let exitedDuringLoad: ReadonlySet<string> = new Set();
    exitCapture.begin();
    watchTerminalExits({ get })();
    const loaded = await Promise.all([invokeTerminalListLive(), readNames(), readSaved()]).finally(
      () => {
        exitedDuringLoad = exitCapture.end();
      },
    );
    const [liveTerminals, names, saved] = loaded;
    const state = get();
    const liveById = new Map(liveTerminals.map((live) => [live.id, live]));
    const rebuilt = new Map<string, TerminalTab[]>();
    const push = ({ tab }: PushParams): void => {
      const key = terminalOwnerKey({ owner: tab.owner });
      const tabs = rebuilt.get(key) ?? [];
      tabs.push(tab);
      rebuilt.set(key, tabs);
    };
    const savedTabs = saved?.tabs ?? [];
    for (const entry of savedTabs) {
      const live = liveById.get(entry.id);
      const isExited =
        exitedDuringLoad.has(entry.id) || (live === undefined && entry.status === 'exited');
      push({
        tab: {
          id: entry.id,
          owner: entry.owner,
          title: names[entry.id] ?? entry.title,
          cwd: live?.cwd ?? entry.cwd,
          ...(entry.projectId === undefined ? {} : { projectId: entry.projectId }),
          ...(entry.mountId === undefined ? {} : { mountId: entry.mountId }),
          status: isExited ? 'exited' : 'running',
          ...(isExited && entry.openError !== undefined ? { openError: entry.openError } : {}),
          ...(live === undefined && !isExited ? { isRestored: true } : {}),
          createdAt: Date.now(),
        },
      });
    }
    const savedIds = new Set<string>(savedTabs.map((entry) => entry.id));
    for (const live of liveTerminals) {
      if (exitedDuringLoad.has(live.id) || savedIds.has(live.id)) {
        continue;
      }
      const parsed = parseTerminalId({ id: live.id });
      if (parsed === null) {
        continue;
      }
      const { owner } = parsed;
      const cwd = live.cwd;
      const mounts =
        owner.kind === 'session' ? (state.sessionProjectMounts[owner.sessionId] ?? []) : [];
      const mount =
        cwd === '' ? undefined : mounts.find((candidate) => candidate.worktreePath === cwd);
      const projectId = mount?.projectId;
      push({
        tab: {
          id: live.id as TerminalTabId,
          owner,
          title: names[live.id] ?? DEFAULT_TERMINAL_NAME,
          cwd,
          ...(projectId === undefined ? {} : { projectId }),
          ...(mount?.mountId === undefined ? {} : { mountId: mount.mountId }),
          status: 'running',
          createdAt: Date.now(),
        },
      });
    }
    set((current) => {
      const terminalTabs = { ...current.terminalTabs };
      const activeTerminalTab = { ...current.activeTerminalTab };
      const terminalWorktreeActive = { ...current.terminalWorktreeActive };
      const allIds = new Set<string>();
      for (const [key, tabs] of rebuilt) {
        if (savedIds.size === 0) {
          tabs.sort((left, right) => left.id.localeCompare(right.id, undefined, { numeric: true }));
        }
        for (const tab of tabs) {
          allIds.add(tab.id);
        }
        terminalTabs[key] = tabs;
        const savedActive = saved?.active[key];
        activeTerminalTab[key] =
          savedActive !== undefined && tabs.some((tab) => tab.id === savedActive)
            ? savedActive
            : (tabs[0]?.id ?? null);
        for (const tab of [...tabs].reverse()) {
          terminalWorktreeActive[terminalWorktreeKeyIn({ state: current, tab })] = tab.id;
        }
      }
      for (const [worktree, id] of Object.entries(saved?.worktreeActive ?? {})) {
        if (allIds.has(id)) {
          terminalWorktreeActive[worktree] = id;
        }
      }
      const savedSelection = saved?.selection ?? null;
      const isSelectionKept =
        savedSelection !== null &&
        (savedSelection.terminalId === null || allIds.has(savedSelection.terminalId));
      return {
        terminalTabs,
        activeTerminalTab,
        terminalWorktreeActive,
        terminalNames: names,
        terminalOrdinals: { ...current.terminalOrdinals, ...ordinalsOf({ saved, rebuilt }) },
        ...(isSelectionKept && current.terminalSelection === null
          ? { terminalSelection: savedSelection }
          : {}),
      };
    });
    markTerminalTabsLoaded();
    saveTerminalTabs({ get });
  };
};
