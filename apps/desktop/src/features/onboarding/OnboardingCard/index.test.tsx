import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OnboardingStepId } from '../onboarding-store';

const { finishMock, progress } = vi.hoisted(() => ({
  finishMock: vi.fn(),
  progress: {
    completedCount: 0,
    totalCount: 2,
    completed: new Set<OnboardingStepId>(),
    collapsed: true,
    finished: false,
    isDone: false,
    isSimple: false,
  },
}));

vi.mock('../onboarding-store', () => ({
  OPEN_WIZARD_EVENT: 'goodboy:open-onboarding-wizard',
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
  progress.completedCount = 0;
  progress.completed = new Set<OnboardingStepId>();
});

afterEach(() => {
  cleanup();
  finishMock.mockReset();
});

import { tooltipTextOf } from '../../../__tests__/helpers/tooltip';
import { OnboardingCard, OnboardingChip } from './index';

describe('OnboardingCard', () => {
  it('points the hide control at the top bar, where the reopen chip lives', () => {
    progress.collapsed = false;
    render(<OnboardingCard />);
    const hide = screen.getByRole('button', { name: 'Hide onboarding checklist' });
    expect(tooltipTextOf({ element: hide })).toBe(
      'Hide onboarding checklist (reopen it from the top bar)',
    );
  });

  it('never sends the user to the sidebar, which holds no onboarding control', () => {
    progress.collapsed = false;
    render(<OnboardingCard />);
    const hide = screen.getByRole('button', { name: 'Hide onboarding checklist' });
    expect(tooltipTextOf({ element: hide })).not.toMatch(/sidebar/i);
  });
});

describe('OnboardingChip', () => {
  it('fills the completed checklist ids instead of leading positions', () => {
    progress.completedCount = 1;
    progress.completed = new Set(['session']);
    const { container } = render(<OnboardingChip />);
    const dots = container.querySelectorAll('[aria-hidden="true"]');
    expect(dots[0]?.className).toContain('bg-border');
    expect(dots[1]?.className).toContain('bg-primary');
  });

  it('finishes onboarding from the skip button', () => {
    render(<OnboardingChip />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip tutorial' }));
    expect(finishMock).toHaveBeenCalledOnce();
  });
});
