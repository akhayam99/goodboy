// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GitMerge } from 'lucide-react';
import type { ResolvedAction } from '../../types';
import type { ActionControls } from '../../useActionControls';
import { ActionConfirmPanel } from './ActionConfirmPanel';

afterEach(cleanup);

const MERGE: ResolvedAction = {
  id: 'pullRequest.merge',
  label: 'Merge',
  shortLabel: 'Merge',
  icon: GitMerge,
  group: 'act',
  slot: 'primary',
  pendingLabel: null,
  shortcut: null,
  description: null,
  blockedReason: null,
  isUndoable: false,
  choices: null,
  isBusy: false,
  confirm: {
    title: 'Merge #318 into main?',
    description: 'Choose how it lands on main.',
    confirmLabel: 'Merge',
    role: 'primary',
    choice: {
      label: 'Merge method',
      defaultId: 'squash',
      options: [
        {
          id: 'squash',
          label: 'Squash and merge',
          detail: 'One commit on main',
          disabledReason: null,
        },
        {
          id: 'merge',
          label: 'Merge commit',
          detail: 'All 5 commits and a merge commit',
          disabledReason: 'Turned off in payments-api',
        },
        {
          id: 'rebase',
          label: 'Rebase and merge',
          detail: '5 commits on top of main',
          disabledReason: null,
        },
      ],
    },
  },
};

const controlsOf = ({
  confirming,
  confirm,
}: {
  readonly confirming: ResolvedAction | null;
  readonly confirm: ActionControls['confirm'];
}): ActionControls => ({
  target: null,
  actions: [],
  inSlot: () => [],
  pendingId: null,
  confirming,
  failure: null,
  trigger: () => undefined,
  confirm,
  cancel: () => undefined,
  retry: () => undefined,
});

describe('ActionConfirmPanel with a choice', () => {
  it('starts on the default option and confirms with it', () => {
    const confirm = vi.fn(async () => undefined);
    render(<ActionConfirmPanel controls={controlsOf({ confirming: MERGE, confirm })} />);

    expect(
      screen.getByRole('tab', { name: /Squash and merge/ }).getAttribute('aria-selected'),
    ).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));

    expect(confirm).toHaveBeenCalledWith({ choice: 'squash' });
  });

  it('confirms with the option picked', () => {
    const confirm = vi.fn(async () => undefined);
    render(<ActionConfirmPanel controls={controlsOf({ confirming: MERGE, confirm })} />);

    fireEvent.click(screen.getByRole('tab', { name: /Rebase and merge/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));

    expect(confirm).toHaveBeenCalledWith({ choice: 'rebase' });
  });

  it('shows an option the host forbids disabled, with its reason, and never picks it', () => {
    const confirm = vi.fn(async () => undefined);
    render(<ActionConfirmPanel controls={controlsOf({ confirming: MERGE, confirm })} />);

    const forbidden = screen.getByRole('tab', { name: /Merge commit/ }) as HTMLButtonElement;
    expect(forbidden.disabled).toBe(true);
    expect(forbidden.textContent).toContain('Turned off in payments-api');
    fireEvent.click(forbidden);
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));

    expect(confirm).toHaveBeenCalledWith({ choice: 'squash' });
  });

  it('draws nothing while no action is confirming', () => {
    render(
      <ActionConfirmPanel
        controls={controlsOf({ confirming: null, confirm: vi.fn(async () => undefined) })}
      />,
    );

    expect(screen.queryByRole('group')).toBeNull();
  });
});
