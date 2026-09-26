import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OPEN_WIZARD_EVENT } from '../onboarding-store';
import { StepRow } from './StepRow';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('StepRow', () => {
  it.each([
    { id: 'codeHost', step: 'code-host' },
    { id: 'taskManager', step: 'tasks' },
  ] satisfies ReadonlyArray<{ id: 'codeHost' | 'taskManager'; step: string }>)(
    'reopens the $step wizard step on its own for the $id item',
    ({ id, step }) => {
      const dispatch = vi.spyOn(window, 'dispatchEvent');
      render(<StepRow id={id} title="Connect" why="Connect it" done={false} />);
      fireEvent.click(screen.getByRole('button', { name: 'Set up Connect' }));
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: OPEN_WIZARD_EVENT, detail: { mode: 'single', step } }),
      );
    },
  );

  it('opens the workspace profile for Tell agents about you', () => {
    const dispatch = vi.spyOn(window, 'dispatchEvent');
    render(<StepRow id="profile" title="Tell agents about you" why="Optional" done={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Set up Tell agents about you' }));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'goodboy:open-settings',
        detail: { scope: 'workspace', section: 'profile' },
      }),
    );
  });
});
