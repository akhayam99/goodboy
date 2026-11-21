// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../store/storyHarness')).dbModuleMock());
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).dbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import {
  brandId,
  type Agent,
  type IsoDateTime,
  type MountAgent,
  type MountId,
  type SessionId,
} from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import type { TerminalTab, TerminalTabId } from '../../shared/types/terminal';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import {
  ledgerCore,
  mountGithubOf,
  mountOf,
  notifyRelay,
  sessionOf,
} from '../workspace/testing/sessionColumn';
import { trackOf, type Track, type TrackTerminal } from './trackOf';

const SESSION = sessionOf({ goal: 'Harborline ledger export' });
const S1 = brandId<SessionId>({ value: SESSION.id });
const OTHER = brandId<SessionId>({ value: 'session-northwind' });
const LEDGER = mountOf({ session: SESSION, project: ledgerCore });
const NOTIFY = mountOf({ session: SESSION, project: notifyRelay });

type TabParams = {
  readonly id: string;
  readonly mountId?: MountId;
};

const tabOf = ({ id, mountId }: TabParams): TerminalTab => ({
  id: brandId<TerminalTabId>({ value: id }),
  owner: { kind: 'session', sessionId: S1 },
  title: id,
  cwd: null,
  ...(mountId === undefined ? {} : { mountId }),
  status: 'running',
  createdAt: 1,
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

describe('trackOf', () => {
  it('joins the mount, its pull request, its terminals and its agents by mount id', () => {
    const ledgerAgent = anAgent({ sessionId: S1, mountId: LEDGER.mountId, status: 'running' });
    const notifyAgent = anAgent({ sessionId: S1, mountId: NOTIFY.mountId });
    const removedAgent = anAgent({
      sessionId: S1,
      mountId: LEDGER.mountId,
      deletedAt: brandId<IsoDateTime>({ value: '2026-11-20T09:00:00.000Z' }),
    });
    const chatAgent = anAgent({ sessionId: S1 });
    const ledgerPr = mountGithubOf({ mount: LEDGER, number: 418 });
    useAppStore.setState({
      sessionProjectMounts: { [S1]: [LEDGER, NOTIFY] },
      mountGithub: { [LEDGER.mountId]: ledgerPr },
      mountSelectedPr: {
        [LEDGER.mountId]: {
          provider: 'github',
          host: 'github.com',
          repoSlug: 'acme/ledger-core',
          prNumber: 418,
        },
      },
      terminalTabs: {
        [S1]: [
          tabOf({ id: 'ledger-shell', mountId: LEDGER.mountId }),
          tabOf({ id: 'notify-shell', mountId: NOTIFY.mountId }),
          tabOf({ id: 'session-shell' }),
        ],
      },
      sessionPhaseRuns: { [S1]: [ledgerAgent, notifyAgent, removedAgent, chatAgent] },
    });

    const track = trackOf({
      state: useAppStore.getState(),
      sessionId: S1,
      mountId: LEDGER.mountId,
    });

    expect(track?.mount).toEqual(LEDGER);
    expect(track?.github).toBe(ledgerPr);
    expect(track?.selectedPr?.prNumber).toBe(418);
    expect(track?.terminals.map((tab) => tab.id)).toEqual(['ledger-shell']);
    expect(track?.agents.map((agent) => agent.id)).toEqual([ledgerAgent.id]);
    const notify = trackOf({
      state: useAppStore.getState(),
      sessionId: S1,
      mountId: NOTIFY.mountId,
    });
    expect(notify?.github).toBeNull();
    expect(notify?.selectedPr).toBeNull();
    expect(notify?.terminals.map((tab) => tab.id)).toEqual(['notify-shell']);
    expect(notify?.agents.map((agent) => agent.id)).toEqual([notifyAgent.id]);
  });

  it('finds the mount by id after its folder moved', () => {
    useAppStore.setState({ sessionProjectMounts: { [S1]: [LEDGER] } });
    const before = trackOf({
      state: useAppStore.getState(),
      sessionId: S1,
      mountId: LEDGER.mountId,
    });
    const moved = { ...LEDGER, worktreePath: '/work/moved/ledger-core' };
    useAppStore.setState({ sessionProjectMounts: { [S1]: [moved] } });

    const after = trackOf({
      state: useAppStore.getState(),
      sessionId: S1,
      mountId: LEDGER.mountId,
    });

    expect(before?.mount.worktreePath).toBe(LEDGER.worktreePath);
    expect(after?.mount.worktreePath).toBe('/work/moved/ledger-core');
  });

  it('has no track for a mount of another session or a mount that is gone', () => {
    useAppStore.setState({ sessionProjectMounts: { [S1]: [LEDGER] } });

    expect(
      trackOf({ state: useAppStore.getState(), sessionId: OTHER, mountId: LEDGER.mountId }),
    ).toBeNull();
    expect(
      trackOf({ state: useAppStore.getState(), sessionId: S1, mountId: NOTIFY.mountId }),
    ).toBeNull();
  });

  it('types the mount id as required on every agent and terminal of a track', () => {
    expectTypeOf<MountAgent['mountId']>().toEqualTypeOf<MountId>();
    expectTypeOf<TrackTerminal['mountId']>().toEqualTypeOf<MountId>();
    expectTypeOf<Agent>().not.toMatchTypeOf<MountAgent>();
    expectTypeOf<TerminalTab>().not.toMatchTypeOf<TrackTerminal>();
    expectTypeOf<Track['agents'][number]>().toEqualTypeOf<MountAgent>();
    expectTypeOf<Track['terminals'][number]>().toEqualTypeOf<TrackTerminal>();
  });
});
