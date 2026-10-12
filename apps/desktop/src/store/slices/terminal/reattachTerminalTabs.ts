import { getSetting } from '@goodboy/db';
import { invokeTerminalListLive } from '../../../features/terminal/terminal';
import { terminalOutputBus } from '../../../features/terminal/outputBus';
import { tauriDatabase } from '../../../shared/lib/db';
import type { TerminalTab, TerminalTabId } from '../../../shared/types/terminal';
import { SETTING_TERMINAL_NAMES } from './state';
import {
  DEFAULT_TERMINAL_NAME,
  folderName,
  parseTerminalId,
  terminalOwnerKey,
} from './terminalOwner';
import type { GetFn, SetFn } from './types';
import { watchTerminalExits } from './watchTerminalExits';

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

export const reattachTerminalTabs = (set: SetFn, get: GetFn) => {
  return async (): Promise<void> => {
    await terminalOutputBus.register();
    watchTerminalExits(get)();
    const [liveTerminals, names] = await Promise.all([invokeTerminalListLive(), readNames()]);
    const state = get();
    const rebuilt = new Map<string, TerminalTab[]>();
    for (const live of liveTerminals) {
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
      const tab: TerminalTab = {
        id: live.id as TerminalTabId,
        owner,
        title: names[live.id] ?? folderName({ path: cwd }) ?? DEFAULT_TERMINAL_NAME,
        cwd,
        ...(projectId === undefined ? {} : { projectId }),
        ...(mount?.mountId === undefined ? {} : { mountId: mount.mountId }),
        status: 'running',
        createdAt: Date.now(),
      };
      const key = terminalOwnerKey({ owner });
      const tabs = rebuilt.get(key) ?? [];
      tabs.push(tab);
      rebuilt.set(key, tabs);
    }
    set((current) => {
      const terminalTabs = { ...current.terminalTabs };
      const activeTerminalTab = { ...current.activeTerminalTab };
      for (const [key, tabs] of rebuilt) {
        tabs.sort((left, right) => left.id.localeCompare(right.id, undefined, { numeric: true }));
        terminalTabs[key] = tabs;
        activeTerminalTab[key] = tabs[0]?.id ?? null;
      }
      return { terminalTabs, activeTerminalTab, terminalNames: names };
    });
  };
};
