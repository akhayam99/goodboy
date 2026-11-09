// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { MountSnapshot } from '@goodboy/core/auto';
import { AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type AutoDelegationId } from '@goodboy/types';
import {
  importStore,
  openStorySqlite,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../store/storyHarness';
import { makeGate } from '../../../store/runtime/auto/testing/makeGate';
import {
  autoDelegates,
  autoTurnEnds,
  childTurnEnds,
  makeRuntimeWorld,
  userSays,
  type RuntimeWorld,
} from '../../../store/runtime/auto/testing/runtimeWorld';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { registerPublishPort, type PublishPort } from '../publishPort';
import { AutoDelegationLines } from './AutoDelegationLines';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

const LEDGER_PATH = '/work/harborline/ledger-core';
const START: MountSnapshot = { head: 'base000', entries: [], isPartial: false };
const END: MountSnapshot = { head: 'abc123', entries: [], isPartial: false };
const STALE = 'Origin changed. Check again before force pushing.';
const PUSHED_LINE =
  'Force pushed ak/ledger-export at abc123, the earlier online version is kept as a backup';

let useAppStore: StoryStore;
let world: RuntimeWorld;
let stopFollowing: () => void = () => undefined;
const reportError = vi.fn(async () => undefined);

const realPort: PublishPort = ({ act, delegationIds }) =>
  world.runtime.publish({
    act,
    delegationIds: delegationIds.map((value) => brandId<AutoDelegationId>({ value })),
  });

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  reportError.mockClear();
  useAppStore.setState({ reportError });
  world = await makeRuntimeWorld({ database: await openStorySqlite() });
  await userSays({ world, id: 'outbox-user-1', text: 'tidy the history and push it' });
  world.state.ports.setSnapshots(LEDGER_PATH, [START, END]);
  await autoDelegates({
    world,
    spec: {
      children: [
        {
          role: 'implementer',
          task: 'rewrite the history of ledger-core',
          reason: 'a code change',
          mount: 'mount-ledger-core',
          publish: 'force',
        },
      ],
    },
  });
  await autoTurnEnds({ world });
  const turn = world.state.ports.childTurns[0];
  await childTurnEnds({
    world,
    index: 0,
    text: `Done.\n<<step-done id="${turn?.childAgentId ?? ''}">>`,
  });
  registerPublishPort({ port: realPort });
  await useAppStore.getState().loadAutoTrees({ sessionId: AUTO_SEED_SESSION });
});

afterEach(() => {
  stopFollowing();
  stopFollowing = () => undefined;
  cleanup();
  registerPublishPort({ port: null });
});

const viewNow = (): AutoTreeView => {
  const view = useAppStore.getState().autoTreeViews[AUTO_SEED_SESSION]?.[0];
  if (view === undefined) {
    throw new Error('no Auto tree in the store');
  }
  return view;
};

type LinesParams = {
  readonly view: AutoTreeView;
};

const linesOf = ({ view }: LinesParams) => (
  <AutoDelegationLines
    sessionId={AUTO_SEED_SESSION}
    view={view}
    delegations={view.delegations}
    agents={[]}
    onOpenChild={vi.fn()}
  />
);

const renderFromStore = (): void => {
  const rendered = render(linesOf({ view: viewNow() }));
  stopFollowing = useAppStore.subscribe(() => {
    rendered.rerender(linesOf({ view: viewNow() }));
  });
};

type FindParams = {
  readonly text: string;
};

const findInRow = async ({ text }: FindParams): Promise<HTMLElement> =>
  waitFor(() => within(screen.getByRole('group', { name: 'Force push' })).getByText(text));

const delegationIdsOf = (): ReadonlyArray<AutoDelegationId> =>
  viewNow().delegations.map((delegation) => delegation.id);

describe('the force push row, read back through the store', () => {
  it('shows Pushing at once, then the pushed line in place of the ask', async () => {
    const gate = makeGate();
    registerPublishPort({
      port: async (params) => {
        await gate.promise;
        return realPort(params);
      },
    });
    renderFromStore();

    fireEvent.click(screen.getByRole('button', { name: 'Force push' }));

    expect(screen.getByRole('button', { name: 'Pushing' }).getAttribute('aria-busy')).toBe('true');
    gate.open();
    await findInRow({ text: PUSHED_LINE });
    expect(screen.queryByRole('group', { name: 'Confirm the force push' })).toBeNull();
    expect(reportError).not.toHaveBeenCalled();
  });

  it('shows the reason of a failed push in place, and Retry push asks again and pushes', async () => {
    world.state.ports.setPushOutcomes([{ kind: 'stale', message: STALE }]);
    renderFromStore();

    fireEvent.click(screen.getByRole('button', { name: 'Force push' }));
    await findInRow({ text: `Not pushed: ${STALE}` });
    fireEvent.click(screen.getByRole('button', { name: 'Retry push' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Force push' }));

    await findInRow({ text: PUSHED_LINE });
    expect(world.state.ports.pushes).toHaveLength(2);
    expect(reportError).not.toHaveBeenCalled();
  });

  it('reads Not pushed after Do not push', async () => {
    renderFromStore();

    fireEvent.click(screen.getByRole('button', { name: "Don't push" }));

    await findInRow({ text: 'Not pushed: you declined the push of ak/ledger-export' });
    expect(world.state.ports.pushes).toEqual([]);
  });

  it('answers a stale card from a second window with the saved result, no second push and no toast', async () => {
    const stale = viewNow();
    renderFromStore();
    fireEvent.click(screen.getByRole('button', { name: 'Force push' }));
    await findInRow({ text: PUSHED_LINE });
    stopFollowing();
    cleanup();

    render(linesOf({ view: stale }));
    fireEvent.click(screen.getByRole('button', { name: 'Force push' }));

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Force push' }).getAttribute('aria-busy'),
      ).toBeNull(),
    );
    expect(world.state.ports.pushes).toHaveLength(1);
    expect(reportError).not.toHaveBeenCalled();
    expect(viewNow().delegations[0]?.result).toMatchObject({
      verified: { publish: { state: 'pushed' } },
    });
  });

  it('drops a late answer once another window already pushed', async () => {
    const gate = makeGate();
    registerPublishPort({
      port: async (params) => {
        await gate.promise;
        return realPort(params);
      },
    });
    renderFromStore();
    fireEvent.click(screen.getByRole('button', { name: 'Force push' }));

    await world.runtime.publish({ act: 'confirm', delegationIds: delegationIdsOf() });
    await act(async () => {
      await useAppStore.getState().loadAutoTrees({ sessionId: AUTO_SEED_SESSION });
    });
    gate.open();

    await findInRow({ text: PUSHED_LINE });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Pushing' })).toBeNull());
    expect(world.state.ports.pushes).toHaveLength(1);
    expect(reportError).not.toHaveBeenCalled();
  });

  it('puts a force push back from the same row', async () => {
    renderFromStore();
    fireEvent.click(screen.getByRole('button', { name: 'Force push' }));
    await findInRow({ text: PUSHED_LINE });
    world.state.ports.setSnapshots(LEDGER_PATH, [END]);

    fireEvent.click(screen.getByRole('button', { name: 'Put back' }));

    await findInRow({
      text: 'Put back: ak/ledger-export is online as it was when the agent started',
    });
    expect(world.state.ports.pushes.at(-1)).toMatchObject({ sha: 'remote111', isForce: true });
  });
});
