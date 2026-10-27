import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OPEN_WIZARD_EVENT, type OnboardingStepId } from '../onboardingSettings';
import type { OnboardingProgress } from '../hooks/useOnboardingProgress';
import { setupProgress } from '../setupProgress';
import { ChecklistBody } from './ChecklistBody';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

type ProgressParams = {
  readonly completed: ReadonlyArray<OnboardingStepId>;
  readonly isWizardDone: boolean;
};

const progressOf = ({ completed, isWizardDone }: ProgressParams): OnboardingProgress => {
  const set = new Set<OnboardingStepId>(completed);
  return {
    setup: setupProgress({ completed: set }),
    details: {
      agents: 'Claude is ready',
      workspace: 'Harborline, 3 folders',
      tools: 'Optional',
      'first-session': 'Ask Scout about the code',
    },
    completed: set,
    isCollapsed: false,
    isFinished: false,
    wizard: isWizardDone ? 'done' : 'later',
    isWizardDone,
    hasWorkspace: true,
    hasProjects: true,
    suggestsProfile: false,
  };
};

const PAUSED = progressOf({ completed: ['agents', 'workspace'], isWizardDone: false });
const FINISHED = progressOf({ completed: ['agents', 'workspace'], isWizardDone: true });

const dispatched = () => vi.spyOn(window, 'dispatchEvent');

describe('ChecklistBody', () => {
  it('lists the four steps with the details, done ones without an action', () => {
    render(<ChecklistBody progress={PAUSED} isMainWindow onLeave={vi.fn()} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByText('Harborline, 3 folders')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Open Agents' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Open Tools' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Start First session' })).toBeDefined();
  });

  it('resumes a paused setup at the row picked, and leaves the menu', () => {
    const dispatch = dispatched();
    const onLeave = vi.fn();
    render(<ChecklistBody progress={PAUSED} isMainWindow onLeave={onLeave} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open Tools' }));

    expect(onLeave).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: OPEN_WIZARD_EVENT,
        detail: { mode: 'setup', step: 'tools' },
      }),
    );
  });

  it('opens Tools on its own once setup is done', () => {
    const dispatch = dispatched();
    render(<ChecklistBody progress={FINISHED} isMainWindow onLeave={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open Tools' }));

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: OPEN_WIZARD_EVENT,
        detail: { mode: 'single', step: 'tools' },
      }),
    );
  });

  it('starts a new session from First session once setup is done', () => {
    const dispatch = dispatched();
    render(<ChecklistBody progress={FINISHED} isMainWindow onLeave={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start First session' }));

    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'goodboy:new-session' }));
  });

  it('offers no resume in a second window, where setup does not run', () => {
    render(<ChecklistBody progress={PAUSED} isMainWindow={false} onLeave={vi.fn()} />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});
