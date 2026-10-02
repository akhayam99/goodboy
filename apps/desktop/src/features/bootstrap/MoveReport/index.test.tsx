// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ProjectId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';

const session = aSession({ goal: 'bootstrap' });
const PROJECT_ID = 'proj-cascadia' as ProjectId;

const h = vi.hoisted(() => ({
  store: { bootstrapMoveReport: {} as Record<string, unknown>, dismissBootstrapReport: vi.fn() },
}));

vi.mock('../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof h.store) => T) => selector(h.store),
}));

import { MoveReport } from './index';

const report = (patch: Record<string, unknown> = {}) => ({
  projectId: PROJECT_ID,
  bootstrapSessionId: session.id,
  movedCount: 38,
  kept: [],
  largeFiles: [],
  ignoredAtRisk: [],
  aligned: null,
  ...patch,
});

beforeEach(() => {
  h.store.bootstrapMoveReport = {};
  h.store.dismissBootstrapReport.mockReset();
});

afterEach(cleanup);

describe('MoveReport', () => {
  it('renders nothing for a session that was not the move target', () => {
    h.store.bootstrapMoveReport = { [PROJECT_ID]: report() };

    const { container } = render(<MoveReport sessionId={aSession().id} />);

    expect(container.textContent).toBe('');
  });

  it('says what moved and can be dismissed', () => {
    h.store.bootstrapMoveReport = { [PROJECT_ID]: report() };
    render(<MoveReport sessionId={session.id} />);

    expect(screen.getByText('Moved 38 files into this session')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(h.store.dismissBootstrapReport).toHaveBeenCalledWith({ projectId: PROJECT_ID });
  });

  it('lists what stayed, what is too large and what was ignored', () => {
    h.store.bootstrapMoveReport = {
      [PROJECT_ID]: report({
        movedCount: 1,
        kept: ['README.md'],
        largeFiles: ['video.mp4'],
        ignoredAtRisk: ['.env'],
        aligned: { kind: 'skipped', reason: 'histories-differ' },
      }),
    };
    render(<MoveReport sessionId={session.id} />);

    expect(screen.getByText('Moved 1 file into this session')).toBeDefined();
    expect(screen.getByText(/changed again: README.md/)).toBeDefined();
    expect(screen.getByText(/refuses files over 100 MB.*video.mp4/)).toBeDefined();
    expect(screen.getByText(/Ignored files stay in the project folder: .env/)).toBeDefined();
    expect(screen.getByText(/local main was left as it is/)).toBeDefined();
  });
});
