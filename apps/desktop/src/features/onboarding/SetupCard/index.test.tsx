// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { OnboardingStepId } from '../onboardingSettings';
import { setupProgress } from '../setupProgress';

const { mocks } = vi.hoisted(() => ({
  mocks: {
    progress: {
      completed: new Set<string>(),
      isCollapsed: true,
      isFinished: false,
      wizard: 'done',
      isWizardDone: true,
      hasWorkspace: true,
      hasProjects: true,
      suggestsProfile: false,
      details: {
        agents: 'Claude is ready',
        workspace: 'Harborline, 3 projects',
        'first-session': 'Ask Scout about the code',
      },
    },
    finish: vi.fn(),
  },
}));

vi.mock('../onboardingSettings', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  finish: mocks.finish,
}));

vi.mock('../hooks/useOnboardingProgress', () => ({
  useOnboardingProgress: () => ({
    ...mocks.progress,
    setup: setupProgress({ completed: mocks.progress.completed }),
  }),
}));

import { SetupCard } from './index';

beforeEach(() => {
  mocks.progress.isFinished = false;
  mocks.progress.hasProjects = true;
  mocks.progress.wizard = 'done';
  mocks.progress.isWizardDone = true;
  mocks.progress.suggestsProfile = false;
  mocks.progress.completed = new Set<OnboardingStepId>(['agents', 'workspace']);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.history.replaceState({}, '', '/');
});

describe('the setup card', () => {
  it('counts the three steps in one card until setup is finished', () => {
    render(<SetupCard isMainWindow />);

    const setup = screen.getByRole('region', { name: 'Setup' });
    within(setup).getByText('Setup · 2 of 3');
    expect(within(setup).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('2');
    expect(within(setup).getAllByRole('listitem')).toHaveLength(3);
    expect(within(setup).queryByText(/about you/i)).toBeNull();
  });

  it('is gone once setup is finished or hidden', () => {
    mocks.progress.isFinished = true;
    render(<SetupCard isMainWindow />);

    expect(screen.queryByRole('region', { name: 'Setup' })).toBeNull();
  });

  it('hides itself from its Hide button', () => {
    render(<SetupCard isMainWindow />);

    fireEvent.click(screen.getByRole('button', { name: 'Hide setup' }));

    expect(mocks.finish).toHaveBeenCalledOnce();
  });

  it('draws nothing before a project exists: the board asks for one instead', () => {
    mocks.progress.hasProjects = false;
    render(<SetupCard isMainWindow />);

    expect(screen.queryByRole('region', { name: 'Setup' })).toBeNull();
  });

  it('offers Resume setup while setup is paused, at the step it stopped on', () => {
    mocks.progress.wizard = 'later';
    mocks.progress.isWizardDone = false;
    const listener = vi.fn();
    window.addEventListener('goodboy:open-onboarding-wizard', listener);
    render(<SetupCard isMainWindow />);

    fireEvent.click(screen.getByRole('button', { name: 'Resume setup' }));

    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener('goodboy:open-onboarding-wizard', listener);
  });

  it('offers no Resume setup once the wizard is done', () => {
    render(<SetupCard isMainWindow />);

    expect(screen.queryByRole('button', { name: 'Resume setup' })).toBeNull();
  });

  it('suggests About you after the first session, outside the count', () => {
    mocks.progress.suggestsProfile = true;
    render(<SetupCard isMainWindow />);

    const setup = screen.getByRole('region', { name: 'Setup' });
    within(setup).getByRole('button', { name: 'Open Tell agents about you' });
    within(setup).getByText('Setup · 2 of 3');
  });

  it('stays out of the demo', () => {
    window.history.replaceState({}, '', '/?scene=demo-twin&director=1');
    render(<SetupCard isMainWindow />);

    expect(screen.queryByRole('region', { name: 'Setup' })).toBeNull();
  });
});
