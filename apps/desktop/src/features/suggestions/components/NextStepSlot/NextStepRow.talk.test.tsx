// @vitest-environment happy-dom

const gate = vi.hoisted(() => {
  const state = { isAvailable: true, talk: vi.fn() };
  return state;
});

vi.mock('../../../auto/useTalkItThrough', () => ({
  useTalkItThrough: () => ({ isAvailable: gate.isAvailable, talk: gate.talk }),
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { brandId, type MountId, type SessionId } from '@goodboy/types';
import type { SessionSuggestion } from '../../types';
import type { SuggestionActions } from '../../useSuggestionActions';
import { NextStepRow } from './NextStepRow';

beforeEach(() => {
  gate.isAvailable = true;
  gate.talk.mockReset();
});

afterEach(cleanup);

const SUGGESTION: SessionSuggestion = {
  id: 'merge-pr:mount-web',
  kind: 'merge-pr',
  priority: 40,
  band: 2,
  title: 'Implement the retry guard',
  detail: 'The plan is approved',
  sessionId: brandId<SessionId>({ value: 'session-1' }),
  targetKey: 'pr:mount-web',
  fingerprint: 'merge-pr:mount-web:618',
  payload: {
    mountId: brandId<MountId>({ value: 'mount-web' }),
    projectName: 'web',
    prNumber: 618,
    defaultMethod: 'squash',
  },
};

const choice = (id: string, label: string) => ({
  id,
  label,
  description: '',
  detail: '',
  agentKind: 'tester' as const,
  run: vi.fn(async () => undefined),
});

const renderRow = (actions: SuggestionActions) =>
  render(
    <NextStepRow
      suggestion={SUGGESTION}
      actions={actions}
      compact={false}
      isPending={false}
      onNotNow={vi.fn()}
    />,
  );

const primaryOf = (overrides: Partial<NonNullable<SuggestionActions['primary']>> = {}) => ({
  label: 'Start Implementer',
  shortLabel: 'Start',
  isDisabled: false,
  failureTitle: 'Failed',
  agentKind: 'implementer' as const,
  run: vi.fn(async () => undefined),
  ...overrides,
});

describe('Talk it through with Auto in the more menu of a Next card', () => {
  it('is the last entry after the other roles, and opens the talk with the card as context', () => {
    renderRow({
      primary: primaryOf({
        choices: [
          choice('tester', 'Start Tester instead'),
          choice('reviewer', 'Start Reviewer instead'),
        ],
      }),
      onDismiss: null,
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'More options for Implement the retry guard' }),
    );
    const items = within(screen.getByRole('menu')).getAllByRole('menuitem');

    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Start Tester instead'),
      expect.stringContaining('Start Reviewer instead'),
      expect.stringContaining('Talk it through with Auto'),
    ]);
    fireEvent.click(items[2]!);
    expect(gate.talk).toHaveBeenCalledWith({
      title: 'Implement the retry guard',
      detail: 'The plan is approved',
    });
  });

  it('makes a menu of two for a role card with one other role', () => {
    renderRow({
      primary: primaryOf({ choices: [choice('tester', 'Start Tester instead')] }),
      onDismiss: null,
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'More options for Implement the retry guard' }),
    );

    expect(within(screen.getByRole('menu')).getAllByRole('menuitem')).toHaveLength(2);
    expect(screen.getByRole('menuitem', { name: /Talk it through with Auto/ })).toBeDefined();
  });

  it('draws no menu for a role card with nothing else to offer, as an overflow needs two', () => {
    renderRow({ primary: primaryOf(), onDismiss: null });

    expect(screen.queryByRole('button', { name: /More options/ })).toBeNull();
  });

  it('leaves a card that starts no agent without the entry', () => {
    renderRow({
      primary: primaryOf({ agentKind: undefined, label: 'Push', shortLabel: 'Push' }),
      onDismiss: null,
    });

    expect(screen.queryByRole('button', { name: /More options/ })).toBeNull();
  });

  it('is hidden while the experiment is off, and the menu keeps its other roles', () => {
    gate.isAvailable = false;
    renderRow({
      primary: primaryOf({
        choices: [
          choice('tester', 'Start Tester instead'),
          choice('reviewer', 'Start Reviewer instead'),
        ],
      }),
      onDismiss: null,
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'More options for Implement the retry guard' }),
    );

    expect(screen.queryByRole('menuitem', { name: /Talk it through/ })).toBeNull();
    expect(within(screen.getByRole('menu')).getAllByRole('menuitem')).toHaveLength(2);
  });

  it('leaves a role card with one alternative and the experiment off without a menu, as today', () => {
    gate.isAvailable = false;
    renderRow({
      primary: primaryOf({ choices: [choice('tester', 'Start Tester instead')] }),
      onDismiss: null,
    });

    expect(screen.queryByRole('button', { name: /More options/ })).toBeNull();
  });
});
