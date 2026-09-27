// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SessionSuggestion } from '../../types';
import type { SuggestionActions } from '../../useSuggestionActions';
import { NextStepRow } from './NextStepRow';

afterEach(() => {
  cleanup();
});

const suggestion = (overrides: Partial<SessionSuggestion> = {}): SessionSuggestion =>
  ({
    id: 'merge-pr:mount-web',
    kind: 'merge-pr',
    priority: 44,
    band: 2,
    title: 'Merge #618',
    detail: 'Approved, checks passed',
    sessionId: 'session-1',
    targetKey: 'pr:mount-web',
    fingerprint: 'merge-pr:mount-web:618',
    payload: { mountId: 'mount-web', projectName: 'web', prNumber: 618, defaultMethod: 'squash' },
    ...overrides,
  }) as SessionSuggestion;

describe('NextStepRow', () => {
  it('acts right away when the action does not require a confirm', () => {
    const onAct = vi.fn();
    const actions: SuggestionActions = {
      primary: { label: 'Answer', isDisabled: false, onAct },
      onDismiss: null,
    };
    render(
      <NextStepRow
        suggestion={suggestion({ kind: 'answer-questions' })}
        actions={actions}
        compact={false}
        onNotNow={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));

    expect(onAct).toHaveBeenCalledTimes(1);
  });

  it('arms a confirm-requiring action instead of acting on the first click', () => {
    const onAct = vi.fn();
    const actions: SuggestionActions = {
      primary: { label: 'Merge', isDisabled: false, requiresConfirm: true, onAct },
      onDismiss: null,
    };
    render(
      <NextStepRow
        suggestion={suggestion()}
        actions={actions}
        compact={false}
        onNotNow={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));

    expect(onAct).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });

  it('acts once the armed confirm is clicked again', () => {
    const onAct = vi.fn();
    const actions: SuggestionActions = {
      primary: { label: 'Merge', isDisabled: false, requiresConfirm: true, onAct },
      onDismiss: null,
    };
    render(
      <NextStepRow
        suggestion={suggestion()}
        actions={actions}
        compact={false}
        onNotNow={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));

    expect(onAct).toHaveBeenCalledTimes(1);
  });

  it('disarms on Cancel without acting', () => {
    const onAct = vi.fn();
    const actions: SuggestionActions = {
      primary: { label: 'Merge', isDisabled: false, requiresConfirm: true, onAct },
      onDismiss: null,
    };
    render(
      <NextStepRow
        suggestion={suggestion()}
        actions={actions}
        compact={false}
        onNotNow={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onAct).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('disarms when the row switches to a different suggestion', () => {
    const onAct = vi.fn();
    const actions: SuggestionActions = {
      primary: { label: 'Merge', isDisabled: false, requiresConfirm: true, onAct },
      onDismiss: null,
    };
    const { rerender } = render(
      <NextStepRow
        suggestion={suggestion()}
        actions={actions}
        compact={false}
        onNotNow={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();

    rerender(
      <NextStepRow
        suggestion={suggestion({ id: 'merge-pr:mount-other' })}
        actions={actions}
        compact={false}
        onNotNow={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });
});
