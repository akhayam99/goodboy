// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PlanCommentBar, type PlanCommentBarRan } from './PlanCommentBar';

afterEach(() => {
  cleanup();
});

type RanParams = {
  readonly isLead: boolean;
};

const ranOf = ({ isLead }: RanParams): PlanCommentBarRan => ({
  agentName: isLead ? 'Lead' : 'Implementer',
  canSend: true,
  isLead,
  isSending: false,
  onSend: vi.fn(async () => undefined),
  onCopy: vi.fn(),
});

const show = ({ isLead }: RanParams) =>
  render(
    <PlanCommentBar
      count={2}
      guard={{ canSend: true, reason: null }}
      isSending={false}
      error={null}
      onSend={vi.fn(async () => undefined)}
      ran={ranOf({ isLead })}
    />,
  );

describe('PlanCommentBar after the plan ran', () => {
  it('sends to the Lead that ran the plan with Send to Lead', () => {
    show({ isLead: true });

    expect(screen.getByRole('button', { name: 'Send to Lead' })).toBeDefined();
  });

  it('writes to another agent by its name, never with a Send to word', () => {
    show({ isLead: false });

    expect(screen.getByRole('button', { name: 'Message the Implementer' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Send to/ })).toBeNull();
  });
});
