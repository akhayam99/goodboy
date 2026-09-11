// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Session, SessionEvent, SessionEventKind } from '@goodboy/types';

const { state, toastMock } = vi.hoisted(() => ({
  state: {
    bulkArchiveTask: vi.fn(async () => undefined),
    bulkUnarchiveTask: vi.fn(async () => undefined),
  },
  toastMock: vi.fn(),
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: toastMock }),
}));

import { sessionEventTitle } from '../../timeline/sessionEventPresentation';
import { useSessionArchive } from './index';

const session = (id: string): Session => ({ id, goal: id }) as unknown as Session;

type HarnessProps = {
  readonly sessions: ReadonlyArray<Session>;
};

const Harness = ({ sessions }: HarnessProps) => {
  const { archive, restore } = useSessionArchive();
  return (
    <>
      <button type="button" onClick={() => void archive({ sessions })}>
        archive
      </button>
      <button type="button" onClick={() => void restore({ sessions })}>
        restore
      </button>
    </>
  );
};

beforeEach(() => {
  state.bulkArchiveTask.mockClear();
  state.bulkUnarchiveTask.mockClear();
  toastMock.mockReset();
});
afterEach(cleanup);

describe('useSessionArchive', () => {
  it('archives without a confirmation and offers an undo that restores the same sessions', async () => {
    render(<Harness sessions={[session('s-1'), session('s-2')]} />);

    fireEvent.click(screen.getByRole('button', { name: 'archive' }));

    await waitFor(() => expect(state.bulkArchiveTask).toHaveBeenCalledWith(['s-1', 's-2']));
    const [kind, message, options] = toastMock.mock.calls[0] ?? [];
    expect(kind).toBe('info');
    expect(message).toContain('stay on disk');
    expect(options.title).toBe('2 sessions archived');

    options.action.onClick();

    await waitFor(() => expect(state.bulkUnarchiveTask).toHaveBeenCalledWith(['s-1', 's-2']));
  });

  it('names a single session in the singular', async () => {
    render(<Harness sessions={[session('s-1')]} />);

    fireEvent.click(screen.getByRole('button', { name: 'archive' }));

    await waitFor(() => expect(toastMock).toHaveBeenCalled());
    expect(toastMock.mock.calls[0]?.[2].title).toBe('Session archived');
  });

  it('does nothing at all for an empty selection', async () => {
    render(<Harness sessions={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'archive' }));
    fireEvent.click(screen.getByRole('button', { name: 'restore' }));

    await Promise.resolve();
    expect(state.bulkArchiveTask).not.toHaveBeenCalled();
    expect(state.bulkUnarchiveTask).not.toHaveBeenCalled();
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('reports a restore with the same vocabulary as the archive', async () => {
    render(<Harness sessions={[session('s-1')]} />);

    fireEvent.click(screen.getByRole('button', { name: 'restore' }));

    await waitFor(() => expect(state.bulkUnarchiveTask).toHaveBeenCalledWith(['s-1']));
    expect(toastMock.mock.calls[0]?.[2].title).toBe('Session restored');
  });

  it('titles the toast with the words the timeline row uses for the same fact', async () => {
    const titleOf = (kind: SessionEventKind): string =>
      sessionEventTitle({
        event: { kind, payload: null } as unknown as SessionEvent,
      });

    render(<Harness sessions={[session('s-1')]} />);
    fireEvent.click(screen.getByRole('button', { name: 'archive' }));
    await waitFor(() => expect(toastMock).toHaveBeenCalled());

    expect(toastMock.mock.calls[0]?.[2].title).toBe(titleOf('session_archived'));

    toastMock.mockReset();
    fireEvent.click(screen.getByRole('button', { name: 'restore' }));
    await waitFor(() => expect(toastMock).toHaveBeenCalled());

    expect(toastMock.mock.calls[0]?.[2].title).toBe(titleOf('session_restored'));
  });
});
