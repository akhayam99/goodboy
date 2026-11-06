// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { brandId, type SessionId, type WorkspaceId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { sessionPlace } from '../../../store/slices/navigation/place';
import { useRowReturn } from './index';

const HARBORLINE = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const SESSION = brandId<SessionId>({ value: 'session-retries' });
const ROW_IDS = ['run-ledger-core', 'run-notify-relay', 'run-payments-api'];

let useAppStore: StoryStore;

type RememberParams = {
  readonly rowId: string;
};

type ListProps = {
  readonly onRemember: (remember: (params: RememberParams) => void) => void;
  readonly rowIds?: ReadonlyArray<string>;
};

const RunsList = ({ onRemember, rowIds = ROW_IDS }: ListProps) => {
  const rowReturn = useRowReturn({
    listKey: 'runs',
    rowIds,
    rowAttribute: 'data-row-key',
  });
  onRemember(rowReturn.remember);
  return (
    <ul>
      {rowIds.map((rowId) => (
        <li key={rowId} data-row-key={rowId}>
          {rowId}
        </li>
      ))}
    </ul>
  );
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  act(() => {
    useAppStore.setState({
      currentWorkspaceId: HARBORLINE,
      sessions: [aSession({ id: SESSION, workspaceId: HARBORLINE })],
    });
    useAppStore
      .getState()
      .navigate({ to: sessionPlace({ sessionId: SESSION, lens: 'workflows' }) });
  });
});

afterEach(cleanup);

describe('useRowReturn', () => {
  it('scrolls Back to the row the list was left from', () => {
    let remember: (params: RememberParams) => void = () => undefined;
    const first = render(<RunsList onRemember={(next) => (remember = next)} />);
    act(() => {
      remember({ rowId: 'run-payments-api' });
      useAppStore.getState().navigate({ to: sessionPlace({ sessionId: SESSION, lens: null }) });
    });
    first.unmount();
    const scrolled = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrolled;

    act(() => {
      useAppStore.getState().back();
    });
    render(<RunsList onRemember={() => undefined} />);

    expect(scrolled).toHaveBeenCalledOnce();
    expect(scrolled.mock.contexts[0]).toBe(screen.getByText('run-payments-api'));
  });

  it('scrolls Back again for a second row while the same list stays mounted', () => {
    let remember: (params: RememberParams) => void = () => undefined;
    render(<RunsList onRemember={(next) => (remember = next)} />);
    const scrolled = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrolled;
    act(() => {
      remember({ rowId: 'run-payments-api' });
      useAppStore.getState().navigate({ to: sessionPlace({ sessionId: SESSION, lens: null }) });
    });
    act(() => {
      useAppStore.getState().back();
    });
    expect(scrolled).toHaveBeenCalledOnce();

    act(() => {
      remember({ rowId: 'run-notify-relay' });
      useAppStore.getState().navigate({ to: sessionPlace({ sessionId: SESSION, lens: null }) });
    });
    act(() => {
      useAppStore.getState().back();
    });

    expect(scrolled).toHaveBeenCalledTimes(2);
    expect(scrolled.mock.contexts[1]).toBe(screen.getByText('run-notify-relay'));
  });

  it('returns to the same row when a new row landed above it meanwhile', () => {
    let remember: (params: RememberParams) => void = () => undefined;
    const first = render(<RunsList onRemember={(next) => (remember = next)} />);
    act(() => {
      remember({ rowId: 'run-notify-relay' });
      useAppStore.getState().navigate({ to: sessionPlace({ sessionId: SESSION, lens: null }) });
    });
    first.unmount();
    const scrolled = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrolled;

    act(() => {
      useAppStore.getState().back();
    });
    render(<RunsList onRemember={() => undefined} rowIds={['run-acme-new', ...ROW_IDS]} />);

    expect(scrolled).toHaveBeenCalledOnce();
    expect(scrolled.mock.contexts[0]).toBe(screen.getByText('run-notify-relay'));
  });

  it('falls back to the saved index for a place saved before row ids were kept', () => {
    act(() => {
      useAppStore.getState().amendFocus({ patch: { scroll: { runs: 2 } } });
    });
    const scrolled = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrolled;

    render(<RunsList onRemember={() => undefined} />);

    expect(scrolled.mock.contexts[0]).toBe(screen.getByText('run-payments-api'));
  });

  it('leaves a list it was never left from where it is', () => {
    const scrolled = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrolled;

    render(<RunsList onRemember={() => undefined} />);

    expect(scrolled).not.toHaveBeenCalled();
  });
});
