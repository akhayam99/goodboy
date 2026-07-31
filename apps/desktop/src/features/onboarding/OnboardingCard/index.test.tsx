import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { finishMock } = vi.hoisted(() => ({
  finishMock: vi.fn(),
}));

vi.mock('../onboarding-store', () => ({
  visibleOnboardingSteps: () => [
    { id: 'workspace', title: 'Workspace', why: 'Workspace', group: 'setup' },
    { id: 'session', title: 'Session', why: 'Session', group: 'build' },
  ],
  collapse: vi.fn(),
  finish: finishMock,
  reopen: vi.fn(),
}));

vi.mock('../hooks/useOnboardingProgress', () => ({
  useOnboardingProgress: () => ({
    completedCount: 0,
    totalCount: 2,
    completed: new Set(),
    collapsed: true,
    finished: false,
    isDone: false,
    isSimple: false,
  }),
}));

afterEach(() => {
  cleanup();
  finishMock.mockReset();
});

import { OnboardingChip } from './index';

describe('OnboardingChip', () => {
  it('finishes onboarding from the skip button', () => {
    render(<OnboardingChip />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip tutorial' }));
    expect(finishMock).toHaveBeenCalledOnce();
  });
});
