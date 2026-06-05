// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session } from '@goodboy/types';

const { setAutoRunMock } = vi.hoisted(() => ({
  setAutoRunMock: vi.fn(async () => undefined),
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: { setSessionAutoRun: typeof setAutoRunMock }) => T) =>
    selector({ setSessionAutoRun: setAutoRunMock }),
}));

import { AutoRunToggle } from './index';

afterEach(() => {
  cleanup();
  setAutoRunMock.mockClear();
});

function makeSession(over: Partial<Session> = {}): Session {
  return {
    id: 's1',
    workflowRuns: [],
    autoRun: false,
    ...over,
  } as unknown as Session;
}

describe('AutoRunToggle', () => {
  it('is disabled and labelled unavailable without a workflow', () => {
    render(<AutoRunToggle session={makeSession()} />);
    const btn = screen.getByRole('button', { name: /autorun unavailable/i });
    expect(btn).toBeDefined();
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the off state and toggles to on when clicked', () => {
    const session = makeSession({
      workflowRuns: [
        { id: 'r1', workflowId: 'w1', ordinal: 0, currentStep: 0, autoRun: false },
      ] as never,
    });
    render(<AutoRunToggle session={session} />);
    fireEvent.click(screen.getByRole('button', { name: /autorun off/i }));
    expect(setAutoRunMock).toHaveBeenCalledWith('s1', true);
  });

  it('shows the on state and toggles to off when clicked', () => {
    const session = makeSession({
      workflowRuns: [
        { id: 'r1', workflowId: 'w1', ordinal: 0, currentStep: 0, autoRun: true },
      ] as never,
      autoRun: true,
    });
    render(<AutoRunToggle session={session} />);
    fireEvent.click(screen.getByRole('button', { name: /autorun on/i }));
    expect(setAutoRunMock).toHaveBeenCalledWith('s1', false);
  });
});
