import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlanId, SessionId } from '@goodboy/types';
import { SuggestionRow } from '.';

const suggestion = {
  id: 'plan-ready:plan-1',
  kind: 'plan-ready',
  priority: 20,
  title: 'Ship it',
  detail: 'Ready to implement',
  sessionId: 'session-1' as SessionId,
  payload: { planId: 'plan-1' as PlanId },
} as const;

describe('SuggestionRow', () => {
  afterEach(() => document.body.replaceChildren());
  it.each(['row', 'card', 'compact'] as const)('renders the %s variant', (size) => {
    render(
      <SuggestionRow suggestion={suggestion} size={size} actionLabel="Run" onAction={vi.fn()} />,
    );
    expect(screen.getByText('Ship it')).not.toBeNull();
    expect(screen.getByTestId('suggestion-plan-ready:plan-1')).not.toBeNull();
  });

  it('fires its action and optional dismiss', () => {
    const onAction = vi.fn();
    const onDismiss = vi.fn();
    render(
      <SuggestionRow
        suggestion={suggestion}
        size="card"
        actionLabel="Run"
        onAction={onAction}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByText('Run'));
    fireEvent.click(screen.getByLabelText('Dismiss suggestion'));
    expect(onAction).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
