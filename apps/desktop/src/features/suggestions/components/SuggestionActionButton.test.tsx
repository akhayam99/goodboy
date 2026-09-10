// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SuggestionAction } from '../useSuggestionActions';
import { SuggestionActionButton } from './SuggestionActionButton';

afterEach(cleanup);

describe('SuggestionActionButton', () => {
  it('opens target choices and runs the selected entry', () => {
    const runFirst = vi.fn();
    const runSecond = vi.fn();
    const action = {
      label: 'Rebase',
      isDisabled: false,
      onAct: runFirst,
      choices: [
        {
          id: 'mount-first',
          label: 'web',
          description: 'web-first',
          detail: '7 behind',
          onAct: runFirst,
        },
        {
          id: 'mount-second',
          label: 'web',
          description: 'web-second',
          detail: '3 behind',
          onAct: runSecond,
        },
      ],
    } satisfies SuggestionAction;

    render(<SuggestionActionButton action={action} appearance="ghost" />);
    fireEvent.click(screen.getByRole('button', { name: 'Rebase' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'web web-second 3 behind' }));

    expect(runFirst).not.toHaveBeenCalled();
    expect(runSecond).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
