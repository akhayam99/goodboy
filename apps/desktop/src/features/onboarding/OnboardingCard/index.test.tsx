import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { finishMock, progress } = vi.hoisted(() => ({
  finishMock: vi.fn(),
  progress: {
    completedCount: 0,
    totalCount: 2,
    completed: new Set(),
    collapsed: true,
    finished: false,
    isDone: false,
    isSimple: false,
  },
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
  useOnboardingProgress: () => progress,
}));

beforeEach(() => {
  progress.collapsed = true;
});

afterEach(() => {
  cleanup();
  finishMock.mockReset();
});

import { OnboardingCard, OnboardingChip } from './index';

describe('OnboardingCard', () => {
  it('points the hide control at the top bar, where the reopen chip lives', () => {
    progress.collapsed = false;
    render(<OnboardingCard />);
    const hide = screen.getByRole('button', { name: 'Hide onboarding checklist' });
    expect(hide.getAttribute('title')).toBe(
      'Hide onboarding checklist (reopen it from the top bar)',
    );
  });

  it('never sends the user to the sidebar, which holds no onboarding control', () => {
    progress.collapsed = false;
    render(<OnboardingCard />);
    const hide = screen.getByRole('button', { name: 'Hide onboarding checklist' });
    expect(hide.getAttribute('title')).not.toMatch(/sidebar/i);
  });
});

describe('OnboardingChip', () => {
  it('finishes onboarding from the skip button', () => {
    render(<OnboardingChip />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip tutorial' }));
    expect(finishMock).toHaveBeenCalledOnce();
  });
});
