// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { nextSessionId } from '@goodboy/types/testing';
import type { TerminalTab, TerminalTabId } from '../../../../shared/types/terminal';

const h = vi.hoisted(() => ({
  open: vi.fn(async () => undefined),
  write: vi.fn(async (_terminalId: string, _data: string) => undefined),
}));

vi.mock('../../terminal', () => ({
  invokeTerminalOpen: h.open,
  invokeTerminalWrite: h.write,
  invokeTerminalResize: vi.fn(),
  invokeTerminalSnapshot: vi.fn(),
}));
vi.mock('../../../../shared/components/GenericTerminalPanel/LazyGenericTerminalPanel', () => ({
  LazyGenericTerminalPanel: () => <div />,
}));

import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { TerminalPane } from './TerminalPane';

const SESSION_ID = nextSessionId();
const TAB_ID: TerminalTabId = JSON.parse(JSON.stringify(`${SESSION_ID}::t1`));
const COMMAND =
  'git push --force-with-lease=fix/ledger-postings:a1b2c3d origin fix/ledger-postings';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.clearAllMocks();
});

afterEach(cleanup);

type TabOfParams = {
  readonly patch: Partial<TerminalTab>;
};

const tabOf = ({ patch }: TabOfParams): TerminalTab => ({
  id: TAB_ID,
  owner: { kind: 'session', sessionId: SESSION_ID },
  title: 'ledger-core',
  cwd: '/w/ledger',
  status: 'running',
  createdAt: 0,
  ...patch,
});

const pendingOpen = () => {
  let finish: () => void = () => undefined;
  let fail: (error: Error) => void = () => undefined;
  h.open.mockImplementationOnce(
    () =>
      new Promise<undefined>((resolve, reject) => {
        finish = () => resolve(undefined);
        fail = reject;
      }),
  );
  return {
    finish: () => finish(),
    fail: (error: Error) => fail(error),
  };
};

describe('TerminalPane prefill', () => {
  it('types the command at the prompt without a newline and clears it', async () => {
    const tab = tabOf({ patch: { prefill: COMMAND } });
    store.setState({ terminalTabs: { [SESSION_ID]: [tab] } });

    render(<TerminalPane tab={tab} isActive />);

    await waitFor(() => expect(h.write).toHaveBeenCalledTimes(1));
    const [, data = ''] = h.write.mock.calls[0] ?? [];
    const typed = atob(data);
    expect(typed).toBe(COMMAND);
    expect(typed).not.toContain('\n');
    expect(typed).not.toContain('\r');
    expect(store.getState().terminalTabs[SESSION_ID]?.[0]?.prefill).toBeUndefined();
  });

  it('writes the command once under strict mode', async () => {
    const tab = tabOf({ patch: { prefill: COMMAND } });
    store.setState({ terminalTabs: { [SESSION_ID]: [tab] } });

    render(
      <StrictMode>
        <TerminalPane tab={tab} isActive />
      </StrictMode>,
    );

    await waitFor(() =>
      expect(store.getState().terminalTabs[SESSION_ID]?.[0]?.prefill).toBeUndefined(),
    );
    expect(h.write).toHaveBeenCalledTimes(1);
  });

  it('keeps the command on the tab when the write fails', async () => {
    h.write.mockRejectedValueOnce(new Error('pty closed'));
    const tab = tabOf({ patch: { prefill: COMMAND } });
    store.setState({ terminalTabs: { [SESSION_ID]: [tab] } });

    render(<TerminalPane tab={tab} isActive />);

    await waitFor(() =>
      expect(store.getState().terminalTabs[SESSION_ID]?.[0]?.status).toBe('exited'),
    );
    expect(store.getState().terminalTabs[SESSION_ID]?.[0]?.prefill).toBe(COMMAND);
  });

  it('keeps the command and writes it once on retry when the open rejects', async () => {
    h.open.mockRejectedValueOnce(new Error('spawn failed'));
    const tab = tabOf({ patch: { prefill: COMMAND } });
    store.setState({ terminalTabs: { [SESSION_ID]: [tab] } });

    const first = render(<TerminalPane tab={tab} isActive />);
    await waitFor(() =>
      expect(store.getState().terminalTabs[SESSION_ID]?.[0]?.status).toBe('exited'),
    );
    expect(h.write).not.toHaveBeenCalled();
    expect(store.getState().terminalTabs[SESSION_ID]?.[0]?.prefill).toBe(COMMAND);
    first.unmount();

    render(<TerminalPane tab={tab} isActive />);

    await waitFor(() => expect(h.write).toHaveBeenCalledTimes(1));
  });

  it('writes once from the surviving pane when the first pane unmounts mid open', async () => {
    const gate = pendingOpen();
    const tab = tabOf({ patch: { prefill: COMMAND } });
    store.setState({ terminalTabs: { [SESSION_ID]: [tab] } });

    const drawer = render(<TerminalPane tab={tab} isActive />);
    const page = render(<TerminalPane tab={tab} isActive />);
    drawer.unmount();
    gate.finish();

    await waitFor(() => expect(h.write).toHaveBeenCalledTimes(1));
    expect(h.open).toHaveBeenCalledTimes(1);
    page.unmount();
  });

  it('writes once from the replacement when the only pane unmounts mid open', async () => {
    const gate = pendingOpen();
    const tab = tabOf({ patch: { prefill: COMMAND } });
    store.setState({ terminalTabs: { [SESSION_ID]: [tab] } });

    render(<TerminalPane tab={tab} isActive />).unmount();
    render(<TerminalPane tab={tab} isActive />);
    gate.finish();

    await waitFor(() =>
      expect(store.getState().terminalTabs[SESSION_ID]?.[0]?.prefill).toBeUndefined(),
    );
    expect(h.write).toHaveBeenCalledTimes(1);
  });

  it('ignores a late open rejection from an unmounted pane', async () => {
    const gate = pendingOpen();
    const tab = tabOf({ patch: { prefill: COMMAND } });
    store.setState({ terminalTabs: { [SESSION_ID]: [tab] } });

    render(<TerminalPane tab={tab} isActive />).unmount();
    gate.fail(new Error('late failure'));
    await Promise.resolve();
    await Promise.resolve();

    expect(store.getState().terminalTabs[SESSION_ID]?.[0]?.status).toBe('running');
    expect(store.getState().terminalTabs[SESSION_ID]?.[0]?.openError).toBeUndefined();

    render(<TerminalPane tab={tab} isActive />);

    await waitFor(() => expect(h.write).toHaveBeenCalledTimes(1));
    expect(store.getState().terminalTabs[SESSION_ID]?.[0]?.status).toBe('running');
  });

  it('writes nothing when the tab has no prefill', async () => {
    const tab = tabOf({ patch: {} });
    store.setState({ terminalTabs: { [SESSION_ID]: [tab] } });

    render(<TerminalPane tab={tab} isActive />);

    await waitFor(() => expect(h.open).toHaveBeenCalled());
    expect(h.write).not.toHaveBeenCalled();
  });
});
