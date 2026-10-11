import { expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import type { ScriptGroup } from '../../../features/scripts/scripts';
import { discoveredScriptId } from '../../../features/scripts/scripts';
import { scriptPinId } from '../../../features/scripts/scriptPinId';
import { scriptPinsKey } from '../../../features/scripts/scriptPinsKey';
import { shortcutGlyphs, type ShortcutId } from '../../../shared/keyboard/registry';
import { pressShortcut } from '../../helpers/pressKey';
import { type Ctx, type Row, WAIT, settle, useAppStore } from './harness';

const GROUP: ScriptGroup = {
  source: 'package-json',
  packageName: 'ledger-core',
  relDir: '',
  manager: 'pnpm',
  scripts: [{ name: 'dev', command: 'pnpm run dev', body: 'vite --port 4310' }],
};

const pressed = async (id: ShortcutId, target?: Element): Promise<void> => {
  pressShortcut({ id, ...(target !== undefined && { target }) });
  await settle();
};

const openScripts = async ({ sessionId }: Ctx): Promise<string> => {
  const anchor = await screen.findByRole('button', { name: /^Search \(/ });
  anchor.focus();
  await pressed('lens.scripts');
  const mount = useAppStore.getState().sessionProjectMounts[sessionId]?.[0];
  if (mount === undefined) {
    throw new Error('the world has no mount for the session');
  }
  const key = discoveredScriptId({
    worktreePath: mount.worktreePath,
    source: GROUP.source,
    relDir: '',
    name: 'dev',
  });
  useAppStore.setState((state) => ({
    settings: {
      ...state.settings,
      [scriptPinsKey({ projectId: mount.projectId })]: JSON.stringify([
        scriptPinId({ source: GROUP.source, relDir: '', name: 'dev', savedId: null }),
      ]),
    },
    discoveredScripts: {
      ...state.discoveredScripts,
      [sessionId]: { [mount.worktreePath]: [GROUP] },
    },
    discoveredScriptScans: {
      ...state.discoveredScriptScans,
      [sessionId]: { [mount.worktreePath]: { status: 'ready', error: null } },
    },
  }));
  await screen.findByRole('button', { name: 'Show dev output' }, WAIT);
  await pressed('list.next');
  return key;
};

const runOf = ({
  sessionId,
  key,
}: {
  readonly sessionId: Ctx['sessionId'];
  readonly key: string;
}) => useAppStore.getState().scriptRuns[sessionId]?.[key];

const scriptRow = (row: {
  readonly id: ShortcutId;
  readonly open: Row['open'];
  readonly lands: Row['lands'];
}): Row => ({
  name: `key ${row.id} (${shortcutGlyphs(row.id)})`,
  covers: [`key:${row.id}`],
  open: row.open,
  lands: row.lands,
});

const keyOfDev = (ctx: Ctx): string => {
  const mount = useAppStore.getState().sessionProjectMounts[ctx.sessionId]?.[0];
  return discoveredScriptId({
    worktreePath: mount?.worktreePath ?? '',
    source: GROUP.source,
    relDir: '',
    name: 'dev',
  });
};

export const SCRIPT_KEY_ROWS: ReadonlyArray<Row> = [
  scriptRow({
    id: 'scripts.run',
    open: async (ctx) => {
      await openScripts(ctx);
      await pressed('scripts.run');
    },
    lands: async (ctx) =>
      waitFor(
        () =>
          expect(runOf({ sessionId: ctx.sessionId, key: keyOfDev(ctx) })?.status).toBe('pending'),
        WAIT,
      ),
  }),
  scriptRow({
    id: 'scripts.stop',
    open: async (ctx) => {
      const key = await openScripts(ctx);
      useAppStore.setState((state) => ({
        scriptRuns: {
          ...state.scriptRuns,
          [ctx.sessionId]: {
            [key]: {
              status: 'pending',
              result: null,
              runId: 'keys-run-dev',
              startedAt: Date.now(),
            },
          },
        },
      }));
      await settle();
      await pressed('scripts.stop');
    },
    lands: async (ctx) =>
      waitFor(
        () =>
          expect(runOf({ sessionId: ctx.sessionId, key: keyOfDev(ctx) })?.status).toBe('cancelled'),
        WAIT,
      ),
  }),
];
